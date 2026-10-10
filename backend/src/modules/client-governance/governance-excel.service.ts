import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Workbook, type CellValue, type Worksheet } from 'exceljs';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { ENTERPRISE_PROJECTS } from '../../common/constants/enterprise-projects';
import type { CurrentUser } from '../../common/interfaces/current-user.interface';
import { EnterpriseEntity } from '../../infrastructure/database/entities/enterprise.entity';
import { ClientGovernanceService } from './governance.service';

const FIELDS = ['name', 'region', 'salesOwner', 'enterpriseProjects', 'preDeclarationYear'] as const;
type Field = typeof FIELDS[number];
const LABELS: Record<Field, string> = { name: '企业名称', region: '区域', salesOwner: '销售负责人', enterpriseProjects: '企业项目', preDeclarationYear: '预申报年份' };
const ALIASES: Record<Field, string[]> = {
  name: ['企业名称', '公司名称', '企业全称', '公司全称'], region: ['区域', '所属区域', '管理区域', '企业区域'],
  salesOwner: ['销售负责人', '销售责任人', '销售人员'], enterpriseProjects: ['企业项目', '申报项目', '企业申报项目'],
  preDeclarationYear: ['预申报年份', '预申报年度', '拟申报年份', '拟申报年度'],
};
const normalizeHeader = (value: string) => value.replace(/[\s*＊（()）]/g, '').normalize('NFKC');
const MAX_ROWS = 1000;
const TTL = 30 * 60 * 1000;
type SourceRow = Record<Field, string> & { rowNumber: number; cellErrors: string[] };
type Overview = Awaited<ReturnType<ClientGovernanceService['overview']>>;
type ImportRow = SourceRow & { regionId: string; projects: string[]; year: number | null; status: 'ready' | 'duplicate' | 'error' | 'success'; issues: string[] };
interface Session { owner: string; expires: number; rows: SourceRow[]; usable: boolean; result?: ReturnType<ClientGovernanceExcelService['summarize']> }

/** Deterministic table recognition: never execute formulas, macros or external links. */
@Injectable()
export class ClientGovernanceExcelService {
  private readonly logger = new Logger(ClientGovernanceExcelService.name);
  private readonly sessions = new Map<string, Session>();
  constructor(private readonly governance: ClientGovernanceService, @InjectRepository(EnterpriseEntity) private readonly enterprises: Repository<EnterpriseEntity>) {}

  async export(user: CurrentUser, query: { regionId?: string; keyword?: string; distribution?: string } = {}, template = false) {
    const overview = await this.governance.overview(user);
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet(template ? '企业建档模板' : '企业档案');
    sheet.columns = FIELDS.map((field) => ({ header: LABELS[field], key: field, width: field === 'enterpriseProjects' ? 55 : field === 'name' ? 36 : 22 }));
    if (!template) {
      const keyword = query.keyword?.trim() ?? '';
      const rows = overview.enterprises.filter((item) => (!query.regionId || item.regionId === query.regionId)
        && (!keyword || `${item.name} ${item.salesOwner} ${item.projectName} ${item.projectUsername}`.includes(keyword))
        && (!query.distribution || Boolean(item.projectUserId) === (query.distribution === 'assigned')));
      for (const row of rows) sheet.addRow({ name: row.name, region: row.regionName, salesOwner: row.salesOwner, enterpriseProjects: row.enterpriseProjects.join('；'), preDeclarationYear: row.preDeclarationYear ?? '' });
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.autoFilter = 'A1:E1'; sheet.getRow(1).height = 28;
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF24539A' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    sheet.getColumn(5).numFmt = '0';
    if (template) {
      sheet.getCell('A1').note = '五个字段均必填；一行一家企业。同名档案（包括已删除档案）不会覆盖或重复创建。';
      sheet.getCell('B1').note = `填写已启用区域的完整名称：${overview.regions.filter((r) => r.status === 1).map((r) => r.name).join('、')}`;
      sheet.getCell('D1').note = `至少填写一个项目，多项用中文分号分隔：${ENTERPRISE_PROJECTS.join('；')}`;
      sheet.getCell('E1').note = '填写 2000-2100 的四位整数年份，例如 2027。不自动填写默认年份。';
      for (let row = 2; row <= MAX_ROWS + 1; row++) sheet.getCell(row, 5).dataValidation = { type: 'whole', operator: 'between', allowBlank: false, formulae: [2000, 2100], showErrorMessage: true, errorTitle: '年份无效', error: '请填写 2000-2100 的整数年份' };
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async preview(user: CurrentUser, file: { originalname: string; buffer: Buffer } | undefined, options: { sheetName?: string; headerRow?: string; mapping?: string } = {}) {
    const overview = await this.governance.overview(user);
    if (!file || !/\.xlsx$/i.test(file.originalname) || file.buffer.length > 5 * 1024 * 1024) throw new BadRequestException('请上传不超过 5MB 的 .xlsx 文件');
    this.assertSafeZip(file.buffer);
    const workbook = new Workbook();
    try { await workbook.xlsx.load(file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]); }
    catch { throw new BadRequestException('无法识别此 Excel，请确认文件未损坏、未加密，且确实为 .xlsx 格式'); }
    const sheets = workbook.worksheets.filter((sheet) => sheet.state === 'visible');
    if (!sheets.length || sheets.length > 20) throw new BadRequestException('Excel 必须包含 1-20 个可见工作表');
    const sheet = options.sheetName ? sheets.find((item) => item.name === options.sheetName) : [...sheets].sort((a, b) => this.detectHeader(b).score - this.detectHeader(a).score)[0];
    if (!sheet) throw new BadRequestException('所选工作表不存在');
    if (sheet.columnCount > 100) throw new BadRequestException('工作表列数超过 100，请删除多余格式或空列');
    const headerRow = options.headerRow ? Number(options.headerRow) : this.detectHeader(sheet).row;
    if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > 30) throw new BadRequestException('表头行必须在第 1-30 行');
    const columns = Array.from({ length: Math.max(sheet.columnCount, 5) }, (_, index) => ({ index: index + 1, label: this.cellText(sheet.getRow(headerRow).getCell(index + 1).value).text || `第 ${index + 1} 列（无标题）` }));
    let mapping = this.detectMapping(sheet, headerRow);
    if (options.mapping) {
      let parsed: unknown;
      try { parsed = JSON.parse(options.mapping); } catch { throw new BadRequestException('字段映射格式无效'); }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new BadRequestException('字段映射格式无效');
      mapping = {};
      for (const field of FIELDS) {
        const value = (parsed as Record<string, unknown>)[field];
        if (value === null || value === undefined) continue;
        if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > columns.length) throw new BadRequestException('字段映射包含无效列');
        mapping[field] = Number(value);
      }
    }
    if (new Set(Object.values(mapping)).size !== Object.values(mapping).length) throw new BadRequestException('五个字段不能映射到同一列');
    const missingFields = FIELDS.filter((field) => !mapping[field]).map((field) => LABELS[field]);
    const source: SourceRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRow) return;
      if (!Object.values(row.values).some((value) => { const cell = this.cellText(value as CellValue); return cell.text || cell.error; })) return;
      if (source.length >= MAX_ROWS) throw new BadRequestException(`一次最多导入 ${MAX_ROWS} 家企业，请拆分文件`);
      const item = { rowNumber, cellErrors: [] } as unknown as SourceRow;
      for (const field of FIELDS) {
        const parsed = mapping[field] ? this.cellText(row.getCell(mapping[field]!).value) : { text: '' };
        item[field] = parsed.text.slice(0, 512);
        if (parsed.text.length > 512) item.cellErrors.push(`${LABELS[field]}：单元格内容超过 512 字，请精简后导入`);
        if (parsed.error) item.cellErrors.push(`${LABELS[field]}：${parsed.error}`);
      }
      source.push(item);
    });
    if (!source.length) throw new BadRequestException('所选工作表没有可导入的企业数据，请检查工作表和表头行');
    const rows = await this.validateRows(source, overview);
    const token = randomUUID(); this.pruneSessions();
    const owner = this.owner(user);
    const owned = [...this.sessions].filter(([, session]) => session.owner === owner);
    for (const [id] of owned.slice(0, Math.max(0, owned.length - 2))) this.sessions.delete(id);
    if (this.sessions.size >= 100) throw new BadRequestException('当前导入任务较多，请稍后再试');
    this.sessions.set(token, { owner, expires: Date.now() + TTL, rows: source, usable: !missingFields.length });
    return { token, sheets: sheets.map((item) => item.name), sheetName: sheet.name, headerRow, columns, mapping, missingFields, ...this.summarize(rows) };
  }

  async confirm(user: CurrentUser, token: string) {
    const overview = await this.governance.overview(user); this.pruneSessions();
    const session = this.sessions.get(token);
    if (!session || session.owner !== this.owner(user)) throw new BadRequestException('导入预览已过期或不属于当前账号，请重新上传');
    if (session.result) return session.result;
    if (!session.usable) throw new BadRequestException('字段映射不完整或导入正在处理，请重新识别或稍后重试');
    // Consume before the first await; concurrent confirmations cannot create two batches.
    session.usable = false;
    let rows: ImportRow[];
    try { rows = await this.validateRows(session.rows, overview); }
    catch (error) { session.usable = true; throw error; }
    for (const row of rows) {
      if (row.status !== 'ready') continue;
      try {
        await this.governance.createEnterprise(user, { name: row.name, regionId: row.regionId, salesOwner: row.salesOwner, enterpriseProjects: row.projects, preDeclarationYear: row.year! });
        row.status = 'success';
      } catch (error) {
        if (!(error instanceof BadRequestException || error instanceof ConflictException || error instanceof ForbiddenException)) this.logger.error(`企业导入第 ${row.rowNumber} 行失败`, error instanceof Error ? error.stack : String(error));
        row.status = error instanceof ConflictException ? 'duplicate' : 'error';
        row.issues = [error instanceof BadRequestException || error instanceof ConflictException || error instanceof ForbiddenException ? error.message : '服务异常，本行未导入，请稍后重新上传核对'];
      }
    }
    session.result = this.summarize(rows);
    return session.result;
  }

  async issues(user: CurrentUser, token: string) {
    const overview = await this.governance.overview(user); this.pruneSessions();
    const session = this.sessions.get(token);
    if (!session || session.owner !== this.owner(user)) throw new BadRequestException('导入预览已过期或不属于当前账号');
    const summary = session.result ?? this.summarize(await this.validateRows(session.rows, overview));
    const workbook = new Workbook(); const sheet = workbook.addWorksheet('问题明细');
    sheet.columns = [{ header: '原Excel行号', key: 'rowNumber', width: 16 }, ...FIELDS.map((field) => ({ header: LABELS[field], key: field, width: field === 'enterpriseProjects' ? 50 : 26 })), { header: '处理状态', key: 'state', width: 16 }, { header: '问题说明', key: 'issues', width: 65 }];
    for (const row of summary.rows.filter((row) => ['error', 'duplicate'].includes(row.status))) sheet.addRow({ ...row, state: row.status === 'duplicate' ? '重复跳过' : '校验失败', issues: row.issues.join('；') });
    sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.getRow(1).font = { bold: true };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  summarize(rows: ImportRow[]) {
    return { rows, total: rows.length, ready: rows.filter((r) => r.status === 'ready').length, success: rows.filter((r) => r.status === 'success').length, duplicate: rows.filter((r) => r.status === 'duplicate').length, failed: rows.filter((r) => r.status === 'error').length };
  }

  private async validateRows(source: SourceRow[], overview: Overview): Promise<ImportRow[]> {
    // Include deleted archives: the existing system forbids reusing their names too.
    const existing = await this.enterprises.find({ select: { name: true } });
    const names = new Set(existing.map((item) => item.name.trim().toLocaleLowerCase())); const seen = new Set<string>();
    return source.map((raw) => {
      const row: ImportRow = { ...raw, cellErrors: [...raw.cellErrors], regionId: '', projects: [], year: null, status: 'ready', issues: [...raw.cellErrors] };
      for (const field of FIELDS) if (!row[field].trim()) row.issues.push(`${LABELS[field]}必填`);
      if (row.name && (row.name.length < 2 || row.name.length > 128)) row.issues.push('企业名称需为 2-128 位');
      if (row.salesOwner.length > 64) row.issues.push('销售负责人最多 64 位');
      if (row.region) {
        const regions = overview.regions.filter((region) => region.name.trim() === row.region && region.status === 1);
        if (regions.length !== 1) row.issues.push(regions.length ? '区域名称有重名，无法唯一匹配，请先核对区域配置' : '区域不存在、未启用或不在管理范围内'); else row.regionId = regions[0].id;
      }
      if (row.enterpriseProjects) {
        row.projects = [...new Set(row.enterpriseProjects.split(/[；;、,，\n\r]+/).map((item) => item.trim()).filter(Boolean))];
        const unknown = row.projects.filter((item) => !ENTERPRISE_PROJECTS.some((option) => option === item));
        if (!row.projects.length) row.issues.push('企业项目必填，至少一个有效项目');
        if (unknown.length) row.issues.push(`无法识别企业项目：${unknown.join('、')}`);
        if (row.projects.length > 4) row.issues.push('企业项目最多选择 4 个');
      }
      if (row.preDeclarationYear) {
        const year = row.preDeclarationYear.replace(/\s*年$/, '').trim();
        if (!/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 2100) row.issues.push('预申报年份需为 2000-2100 的四位整数年份'); else row.year = Number(year);
      }
      const key = row.name.toLocaleLowerCase();
      if (row.issues.length) row.status = 'error';
      else if (names.has(key) || seen.has(key)) { row.status = 'duplicate'; row.issues = [names.has(key) ? '系统已有同名企业（含已删除档案），跳过且不覆盖' : 'Excel 内同名企业重复，仅首条有效记录可导入']; }
      if (row.status === 'ready') seen.add(key);
      return row;
    });
  }
  private detectHeader(sheet: Worksheet) {
    let best = { row: 1, score: 0 };
    for (let row = 1; row <= Math.min(sheet.rowCount, 30); row++) { const score = Object.keys(this.detectMapping(sheet, row)).length; if (score > best.score) best = { row, score }; }
    return best;
  }
  private detectMapping(sheet: Worksheet, row: number): Partial<Record<Field, number>> {
    const mapping: Partial<Record<Field, number>> = {};
    for (const field of FIELDS) {
      const matches: number[] = [];
      sheet.getRow(row).eachCell((cell, column) => { if (column <= 100 && ALIASES[field].some((alias) => normalizeHeader(alias) === normalizeHeader(this.cellText(cell.value).text))) matches.push(column); });
      if (matches.length === 1) mapping[field] = matches[0];
    }
    return mapping;
  }
  private cellText(value: CellValue): { text: string; error?: string } {
    if (value === null || value === undefined) return { text: '' };
    if (typeof value === 'string' || typeof value === 'number') return { text: String(value).trim() };
    if (typeof value === 'boolean' || value instanceof Date) return { text: String(value), error: '请使用文本或整数，不支持日期/布尔值' };
    if ('formula' in value || 'sharedFormula' in value) return { text: '[公式]', error: '不支持公式，请粘贴为值后导入' };
    if ('richText' in value) return { text: value.richText.map((part) => part.text).join('').trim() };
    if ('text' in value) return { text: value.text.trim() };
    return { text: '[无效单元格]', error: '单元格包含 Excel 错误值' };
  }
  /** Bound decompressed ZIP size before ExcelJS loads XML. XLSX is a ZIP archive. */
  private assertSafeZip(buffer: Buffer) {
    let end = -1;
    for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset--) {
      if (buffer.readUInt32LE(offset) === 0x06054b50 && offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length) { end = offset; break; }
    }
    if (end < 0) throw new BadRequestException('文件不是有效的 .xlsx 文件');
    const count = buffer.readUInt16LE(end + 10); let cursor = buffer.readUInt32LE(end + 16); let total = 0;
    if (count > 2000 || count === 0xffff) throw new BadRequestException('Excel 文件结构过大');
    for (let index = 0; index < count; index++) {
      if (cursor + 46 > end || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new BadRequestException('Excel 文件结构损坏');
      total += buffer.readUInt32LE(cursor + 24);
      if (total > 30 * 1024 * 1024) throw new BadRequestException('Excel 解压后超过 30MB，请拆分或删除多余内容');
      cursor += 46 + buffer.readUInt16LE(cursor + 28) + buffer.readUInt16LE(cursor + 30) + buffer.readUInt16LE(cursor + 32);
    }
  }
  private owner(user: CurrentUser) { return `${user.appCode ?? ''}:${user.portal}:${user.id}`; }
  private pruneSessions() { for (const [token, session] of this.sessions) if (session.expires < Date.now()) this.sessions.delete(token); }
}
