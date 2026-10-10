import { EnterpriseEmployeeRecordEntity } from '../../../infrastructure/database/entities/enterprise-employee-record.entity';
import { syncWorkspace } from './material-workspace';
import { staffImportTemplate } from './material-workspace-import';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cell, Workbook, Worksheet } from 'exceljs';
import { Repository } from 'typeorm';
import type { HighTechProject } from './high-tech.model';
import { normalizeHighTechScores } from './high-tech.model';

import { HighTechApplicationEntity } from '../../../infrastructure/database/entities/high-tech-application.entity';
import { ClientService } from '../client.service';
import { HighTechIpRecognitionService, IpPdfUpload } from './high-tech-ip-recognition.service';
import { HighTechIpAllocationService } from './high-tech-ip-allocation.service';
import { HighTechNameGenerationService } from './high-tech-name-generation.service';
import { HighTechMaterialService } from './high-tech-material.service';
import { HIGH_TECH_SEARCHABLE_FIELDS, HighTechFieldRecommendationService } from './high-tech-field-recommendation.service';
import { emptyBasicInfo, emptyHighTechDraft, HighTechDraft, HighTechIpItem, IP_LEGAL_STATUSES, IP_PATENT_TYPES, IP_SUMMARY_FIELDS, ipItemErrors, MATERIAL_TYPES, normalizeHighTechDraft, PROJECT_FIELDS, SCORE_FIELDS, sortIpSummaryRows, synchronizeIpNumbers } from './high-tech.model';

const IP_TEMPLATE_INSTRUCTIONS = [
  ['项目', '填写规则'],
  ['数据位置', '只填写“专利证书”工作表，从第 2 行开始，每行一项；请勿合并单元格。'],
  ['必填字段', '名称、专利类型、法律状态、专利号、专利权人、申请日期、授权日期。'],
  ['编号', '选填，可填写 1、2 或 IP01、IP02 等编号；导入后评分表沿用系统排序和编号。'],
  ['专利类型', '支持发明专利、实用新型、外观设计、软件著作权，请按证书填写。'],
  ['专利号', '请使用文本格式，保留字母、前导零和校验位，勿使用公式。'],
  ['申请日期', '必填，填写真实申请日期（如 2023-05-20）；也支持 Excel 日期、2023/5/20、2023年5月20日。'],
  ['授权日期', '必填，填写真实授权日期（如 2024-03-20）；也支持 Excel 日期、2024/3/20、2024年3月20日；授权日期不得早于申请日期。'],
  ['软件著作权', '名称填写软件名称，专利号填写登记号，专利权人填写著作权人。'],
  ['法律状态', '授权、申请中、失效、终止、驳回、撤回；“专利权有效”“有效”“已授权”也按授权解析。不得留空。'],
  ['示例与空行', '“填写示例”仅供参考，不会导入；空白行不会导入。空白模板不会新增证书。'],
  ['校验', '发现必填项缺失、无效类型/状态/日期、公式等问题时会标明行号，整份文件不导入，请修正后重传。'],
  ['文件格式', '上传支持 .xlsx、.xlsm；不支持 .xls，宏与公式不会执行。'],
  ['评分与附件', '导入信息使用已有评分规则；Excel 记录不代表已上传证书 PDF 附件。'],
];
const IP_TEMPLATE_EXAMPLES = [
  ['IP01', '示例：一种智能控制装置', '发明专利', '授权', 'ZL202010123456.7', '示例科技有限公司', '2020-05-20', '2023-06-08'],
  ['IP02', '示例：企业管理软件 V1.0', '软件著作权', '授权', '2024SR0123456', '示例科技有限公司', '2023-09-14', '2024-03-20'],
];

@Injectable()
export class HighTechService {
  constructor(
    @InjectRepository(HighTechApplicationEntity) private readonly repository: Repository<HighTechApplicationEntity>,
    private readonly clientService: ClientService,
    private readonly ipRecognition: HighTechIpRecognitionService,
    private readonly fieldRecommendation: HighTechFieldRecommendationService,
    private readonly ipAllocation: HighTechIpAllocationService,
    private readonly nameGeneration: HighTechNameGenerationService,
    private readonly materialService: HighTechMaterialService,
  ) {}

  private async requireCompany(userId: number, companyId: string) {
    if (!/^[1-9]\d{0,19}$/u.test(companyId)) throw new BadRequestException('企业标识不正确');
    const company = (await this.clientService.getClientCompanies(userId)).find((item) => String(item.id) === companyId);
    if (!company) throw new ForbiddenException('无权访问该企业档案');
    if (!company.enterpriseProjects.some((name) => name.includes('高新技术企业'))) throw new ForbiddenException('该企业未分配高新技术企业申报项目');
    return company;
  }

  async recognizeIpPdfs(userId: number, companyId: string, files: IpPdfUpload[] | undefined) {
    await this.requireCompany(userId, companyId);
    return this.ipRecognition.recognize(files);
  }

  async fieldCatalog(userId: number, companyId: string) {
    await this.requireCompany(userId, companyId);
    return { fields: HIGH_TECH_SEARCHABLE_FIELDS };
  }

  async recommendFields(userId: number, companyId: string, input: unknown) {
    await this.requireCompany(userId, companyId);
    return this.fieldRecommendation.recommend(input);
  }

  async previewIpAllocation(userId: number, companyId: string, input: unknown) {
    await this.requireCompany(userId, companyId);
    return this.ipAllocation.preview(input);
  }

  async generateNames(userId: number, companyId: string, input: unknown) {
    await this.requireCompany(userId, companyId);
    return this.nameGeneration.generate(input);
  }

  async get(userId: number, companyId: string) {
    const company = await this.requireCompany(userId, companyId);
    const entity = await this.repository.findOne({ where: { enterpriseId: companyId } });
    const draft: HighTechDraft = entity ? JSON.parse(entity.draftJson) : emptyHighTechDraft();
    if (draft.nameGeneration && draft.nameGeneration.version !== 2 && draft.nameGeneration.version !== 3) delete draft.nameGeneration;
    draft.basicInfo = { ...emptyBasicInfo(), ...draft.basicInfo };
    for (const row of draft.projects) {
      row.applicationDate ??= '';
      if (!row.ipNumber.trim()) row.acquisitionMethod = '';
    }
    if (draft.ipSummary === undefined) draft.ipSummary = [];
    const defaults = emptyHighTechDraft();
    draft.book = defaults.book.map((item) => draft.book?.find((row) => row.key === item.key) ?? item);
    draft.attachments = defaults.attachments.map((item) => ({ ...item, ...draft.attachments?.find((row) => row.key === item.key) }));
    synchronizeIpNumbers(draft);
    return { ...draft, companyId, companyName: company.name, revision: entity?.revision ?? 0, updatedAt: entity?.updatedAt?.toISOString() ?? null };
  }

  async save(userId: number, companyId: string, input: unknown) {
    const company = await this.requireCompany(userId, companyId);
    const { revision, ...draft } = normalizeHighTechDraft(input);
    if (draft.workspace) syncWorkspace(draft.workspace, draft, company.name);
    const nextRevision = revision + 1;
    const updatedAt = new Date();
    const values = { draftJson: JSON.stringify(draft), revision: nextRevision, updatedAt };
    if (revision === 0) {
      try {
        await this.repository.insert({ ...values, enterpriseId: companyId });
      } catch (error) {
        if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw this.conflict();
        throw error;
      }
    } else {
      const result = await this.repository.update({ enterpriseId: companyId, revision }, values);
      if (result.affected !== 1) throw this.conflict();
    }
    return { ...draft, companyId, companyName: company.name, revision: nextRevision, updatedAt: updatedAt.toISOString() };
  }

  async getScores(userId: number, companyId: string) {
    const company = await this.requireCompany(userId, companyId);
    const saved = await this.repository.findOne({ where: { enterpriseId: companyId } });
    const source = saved ? JSON.parse(saved.draftJson).scores : {};
    const scores = emptyHighTechDraft().scores;
    for (const { key } of SCORE_FIELDS) scores[key] = source?.[key] ?? null;
    return { companyId, companyName: company.name, scores, revision: saved?.revision ?? 0, updatedAt: saved?.updatedAt?.toISOString() ?? null };
  }

  async saveScores(userId: number, companyId: string, input: unknown) {
    const company = await this.requireCompany(userId, companyId);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('评分数据不正确');
    const { revision, scores: source } = input as Record<string, unknown>;
    if (!Number.isSafeInteger(revision) || Number(revision) < 0) throw new BadRequestException('草稿版本不正确');
    const scores = normalizeHighTechScores(source, true);
    const saved = await this.repository.findOne({ where: { enterpriseId: companyId } });
    if ((saved?.revision ?? 0) !== revision) throw this.conflict();
    // Preserve all material and core-information fields, including legacy data.
    const draft = saved ? JSON.parse(saved.draftJson) : emptyHighTechDraft();
    draft.scores = scores;
    const updatedAt = new Date();
    const nextRevision = Number(revision) + 1;
    const values = { draftJson: JSON.stringify(draft), revision: nextRevision, updatedAt };
    if (!saved) {
      try {
        await this.repository.insert({ ...values, enterpriseId: companyId });
      } catch (error) {
        if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw this.conflict();
        throw error;
      }
    } else {
      const result = await this.repository.update({ enterpriseId: companyId, revision: Number(revision) }, values);
      if (result.affected !== 1) throw this.conflict();
    }
    return { companyId, companyName: company.name, scores, revision: nextRevision, updatedAt: updatedAt.toISOString() };
  }

  private conflict() {
    return new ConflictException('草稿已在其他页面更新，请保留当前修改并重新加载，避免覆盖他人内容');
  }

  private async materialDraft(userId: number, companyId: string) {
    const draft = await this.get(userId, companyId);
    if (draft.currentStep < 2) throw new BadRequestException('请先完成高新核心信息并进入第三步');
    return draft;
  }

  async generateBook(userId: number, companyId: string, input: unknown) {
    return this.materialService.generate(await this.materialDraft(userId, companyId), input);
  }

  async generateAttachment(userId: number, companyId: string, input: unknown) {
    return this.materialService.generateAttachment(await this.materialDraft(userId, companyId), input);
  }

  async importMaterial(userId: number, companyId: string, kind: string, year: string, file?: { originalname: string; buffer: Buffer }) {
    return this.materialService.importMaterial(companyId, await this.materialDraft(userId, companyId), kind, year, file);
  }

  async materialStaff(userId: number, companyId: string) {
    await this.materialDraft(userId, companyId);
    const rows = await this.repository.manager.getRepository(EnterpriseEmployeeRecordEntity).find({ where: { enterpriseId: companyId, status: 1 }, order: { id: 'ASC' } });
    const education: Record<number, string> = { 1: '博士', 2: '硕士', 3: '本科', 4: '大专及以下' };
    const title: Record<number, string> = { 1: '高级', 2: '中级', 3: '初级', 4: '高级技工' };
    return rows.filter((r) => r.isActive !== 0).map((r, index) => ({ id: `employee-${r.id}`, seq: String(index + 1), name: r.ygName || '', id_no: r.idCard || '', education: education[r.ygXl ?? 0] || '', title: title[r.ygZc ?? 0] || '', contract: r.laborContractFile ? '是' : '', social_security: r.socialSecurityFile ? '是' : '', is_tech: r.isKjyf === 1 ? '是' : r.isKjyf === 0 ? '否' : '' }));
  }

  async materialStaffTemplate(userId: number, companyId: string) {
    await this.requireCompany(userId, companyId);
    return staffImportTemplate();
  }

  async generateDocument(userId: number, companyId: string, input: unknown) {
    return this.materialService.generateDocument(await this.materialDraft(userId, companyId), input);
  }

  async exportDocument(userId: number, companyId: string, input: unknown) {
    return this.materialService.exportDocument(await this.materialDraft(userId, companyId), input);
  }

  async bookWord(userId: number, companyId: string) {
    const draft = await this.materialDraft(userId, companyId);
    return this.materialService.word(draft.companyName, draft);
  }

  async attachmentList(userId: number, companyId: string) {
    await this.materialDraft(userId, companyId);
    return this.materialService.list(companyId);
  }

  async attachmentUpload(userId: number, companyId: string, category: string, file?: { originalname: string; buffer: Buffer }, reference = '') {
    await this.materialDraft(userId, companyId);
    return this.materialService.upload(companyId, category, file, reference);
  }

  async attachmentFile(userId: number, companyId: string, id: string) {
    await this.materialDraft(userId, companyId);
    return this.materialService.file(companyId, id);
  }

  async attachmentRemove(userId: number, companyId: string, id: string) {
    await this.materialDraft(userId, companyId);
    return this.materialService.remove(companyId, id);
  }

  async attachmentReorder(userId: number, companyId: string, category: string, input: unknown) {
    await this.materialDraft(userId, companyId);
    return this.materialService.reorder(companyId, category, input);
  }

  async attachmentPdf(userId: number, companyId: string) {
    const draft = await this.materialDraft(userId, companyId);
    return this.materialService.completePdf(companyId, draft);
  }

  async materialZip(userId: number, companyId: string) {
    const draft = await this.materialDraft(userId, companyId);
    return this.materialService.zip(companyId, draft, draft.companyName);
  }

  async importIpSummary(userId: number, companyId: string, file?: { originalname: string; buffer: Buffer }) {
    await this.requireCompany(userId, companyId);
    if (!file || !/\.(xlsx|xlsm)$/iu.test(file.originalname)) throw this.importError(['请上传 .xlsx 或 .xlsm 文件，不支持 .xls']);
    if (file.buffer.length > 5 * 1024 * 1024) throw this.importError(['文件不得超过5MB']);
    const workbook = new Workbook();
    try {
      this.assertSafeZip(file.buffer);
      await workbook.xlsx.load(file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch (error) {
      throw this.importError([error instanceof BadRequestException ? error.message : 'Excel 文件读取失败，请检查文件格式']);
    }
    const sheet = workbook.getWorksheet('专利证书');
    if (!sheet) throw this.importError(['未找到“专利证书”工作表']);
    const errors: string[] = [];
    const headerColumns = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, column) => {
      const parsed = this.ipCellText(cell);
      if (parsed.error) errors.push(`第1行：${parsed.error}`);
      headerColumns.set(parsed.text.replace(/\s/gu, ''), column);
    });
    const columns = IP_SUMMARY_FIELDS.map(({ label }, index) => headerColumns.get(label) ?? index + 1);
    const rows: HighTechIpItem[] = [];
    sheet.eachRow((excelRow, rowNumber) => {
      if (rowNumber === 1) return;
      const cells = columns.map((column) => excelRow.getCell(column));
      const values = cells.map((cell, index) => index >= 6
        ? this.ipCellDate(cell, workbook.properties.date1904)
        : this.ipCellText(cell));
      if (!values.some(({ text, error }) => text || error)) return;
      const item = { id: randomUUID() } as HighTechIpItem;
      for (const [index, { key, label }] of IP_SUMMARY_FIELDS.entries()) {
        item[key] = values[index].text;
        if (values[index].error) errors.push(`第${rowNumber}行：${label}，${values[index].error}`);
      }
      if (['专利权有效', '有效', '已授权'].includes(item.legalStatus)) item.legalStatus = '授权';
      for (const error of ipItemErrors(item)) errors.push(`第${rowNumber}行：${error}`);
      rows.push(item);
    });
    if (rows.length > 200) errors.push('知识产权汇总最多支持200条');
    if (errors.length) throw this.importError(errors);
    return { rows, total: rows.length };
  }

  private importError(errors: string[]) {
    return new BadRequestException({ message: '知识产权导入失败，请修正后重传', errors });
  }

  private projectImportError(errors: string[]) {
    return new BadRequestException({ message: '项目详情导入失败，请修正后重传', errors });
  }

  async importProjectDetails(userId: number, companyId: string, file?: { originalname: string; buffer: Buffer }) {
    await this.requireCompany(userId, companyId);
    if (!file || !/\.xlsx$/iu.test(file.originalname)) throw this.projectImportError(['请上传 .xlsx 文件']);
    if (file.buffer.length > 5 * 1024 * 1024) throw this.projectImportError(['文件不得超过5MB']);
    const workbook = new Workbook();
    try {
      this.assertSafeZip(file.buffer);
      await workbook.xlsx.load(file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch (error) {
      throw this.projectImportError([error instanceof BadRequestException ? error.message : 'Excel 文件读取失败，请检查文件格式']);
    }
    const sheet = workbook.getWorksheet('项目详情表');
    if (!sheet) throw this.projectImportError(['未找到“项目详情表”工作表']);
    const errors: string[] = [];
    const fields = sheet.getRow(1).actualCellCount === PROJECT_FIELDS.length - 1
      ? PROJECT_FIELDS.filter(({ key }) => key !== 'applicationDate') : PROJECT_FIELDS;
    fields.forEach(({ label }, index) => {
      const value = this.ipCellText(sheet.getRow(1).getCell(index + 1));
      if (value.error || value.text !== label) errors.push(`第1行第${index + 1}列应为“${label}”，请使用导出的模板并保持列顺序`);
    });
    if (sheet.getRow(1).actualCellCount !== fields.length) errors.push('表头须为15列（兼容旧版14列），请使用导出的模板');
    if (errors.length) throw this.projectImportError(errors);
    const rows: HighTechProject[] = [];
    sheet.eachRow((excelRow, rowNumber) => {
      if (rowNumber === 1 || rows.length > 200) return;
      const values = fields.map(({ key }, index) => {
        const cell = excelRow.getCell(index + 1).master;
        return (key === 'applicationDate' || key === 'authorizationDate') ? this.ipCellDate(cell, workbook.properties.date1904) : this.ipCellText(cell, key !== 'psNumber');
      });
      if (!values.some(({ text, error }) => text.trim() || error)) return;
      const row = { id: randomUUID(), applicationDate: '' } as HighTechProject;
      fields.forEach(({ key, label }, index) => {
        const value = values[index];
        if (value.error) errors.push(`第${rowNumber}行：${label}，${value.error}`);
        if (key === 'year') {
          row.year = value.text ? Number(value.text) : null;
          if (row.year !== null && (!/^\d{4}$/u.test(value.text) || row.year < 1900 || row.year > 2100)) errors.push(`第${rowNumber}行：年份须为1900至2100之间的整数`);
        } else if (key === 'psNumber') {
          // Match the page: number first, optional name on subsequent lines.
          const ps = value.text.split(/\r?\n/u);
          row.psNumber = (ps.shift() ?? '').trim();
          row.psName = ps.join('\n').trim();
        } else row[key] = value.text;
        if (key !== 'year' && (row[key].length > 512 || (key === 'psNumber' && (row.psName?.length ?? 0) > 512))) errors.push(`第${rowNumber}行：${label}不得超过512字`);
      });
      for (const [label, date] of [['申请日期', row.applicationDate], ['授权日期', row.authorizationDate]]) {
        if (date && (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) errors.push(`第${rowNumber}行：${label}不正确，请填写YYYY-MM-DD`);
      }
      if (row.applicationDate && row.authorizationDate && row.authorizationDate < row.applicationDate) errors.push(`第${rowNumber}行：授权日期不得早于申请日期`);
      if (row.ipType && !IP_PATENT_TYPES.includes(row.ipType)) errors.push(`第${rowNumber}行：类型须为发明专利、实用新型、软件著作权或外观设计`);
      if (!row.ipNumber.trim()) row.acquisitionMethod = '';
      if (row.acquisitionMethod && !['原始取得', '转让取得', '许可取得'].includes(row.acquisitionMethod)) errors.push(`第${rowNumber}行：取得方式须为原始取得、转让取得或许可取得`);
      rows.push(row);
    });
    if (rows.length > 200) errors.push('项目详情最多支持200条');
    if (errors.length) throw this.projectImportError(errors);
    return { rows, total: rows.length };
  }

  async exportProjectDetails(userId: number, companyId: string, input: unknown) {
    await this.requireCompany(userId, companyId);
    const rows = input && typeof input === 'object' ? (input as { rows?: unknown }).rows : undefined;
    if (!Array.isArray(rows) || rows.length > 200) throw new BadRequestException('项目详情须为列表，最多支持200条');
    const workbook = new Workbook();
    workbook.creator = 'HQX';
    const sheet = workbook.addWorksheet('项目详情表');
    sheet.addRow(PROJECT_FIELDS.map(({ label }) => label));
    for (const [index, value] of rows.entries()) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException(`第${index + 1}行数据格式不正确`);
      const row = value as Record<string, unknown>;
      const psName = row.psName ?? '';
      if (typeof psName !== 'string' || psName.length > 512) throw new BadRequestException(`第${index + 1}行：PS名称须为不超过512字的文本`);
      sheet.addRow(PROJECT_FIELDS.map(({ key, label }) => {
        const cell = row[key] ?? (key === 'year' ? null : '');
        if (key === 'year') {
          if (cell !== null && (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 1900 || cell > 2100)) throw new BadRequestException(`第${index + 1}行年份须为1900至2100之间的整数`);
          return cell;
        }
        if (typeof cell !== 'string' || cell.length > 512) throw new BadRequestException(`第${index + 1}行：${label}须为不超过512字的文本`);
        if (key === 'acquisitionMethod' && !(typeof row.ipNumber === 'string' && row.ipNumber.trim())) return '';
        return key === 'psNumber' && psName ? `${cell}\n${psName}` : cell;
      }));
    }
    this.mergeProjectDetailsCells(sheet);
    PROJECT_FIELDS.forEach(({ key }, index) => {
      const column = sheet.getColumn(index + 1);
      column.width = ['activityName', 'ipName', 'achievementName', 'techField', 'researchPeriod', 'psNumber'].includes(key) ? 36 : 22;
      column.numFmt = key === 'year' ? '0' : '@';
    });
    sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: PROJECT_FIELDS.length } };
    const instructions = workbook.addWorksheet('填写说明');
    instructions.addRows([
      ['项目', '填写规则'],
      ['数据位置', '请填写“项目详情表”，保持15列表头和顺序不变（仍兼容缺少申请日期的旧版14列模板），从第2行开始填写；最多200条，空白行忽略。'],
      ['替换与保存', '导入校验通过并确认后替换整张项目详情表；空模板会清空原表，点击保存草稿后生效。'],
      ['RD与成果序号', '相同RD序号表示同一研发活动的不同分支，前四列请填写一致；留空RD序号表示独立项目，导入后RD及成果序号自动重新排列。'],
      ['对应PS', '同一单元格第一行填PS编号，第二行填PS名称（Excel中可使用Alt+Enter换行）；没有名称时只填编号。'],
      ['年份与周期', '年份为1900至2100的整数；研发周期建议填写YYYY-MM-DD—YYYY-MM-DD，留空时按年份自动分配。'],
      ['申请日期与授权日期', '授权日期不得早于申请日期。填写YYYY-MM-DD，也支持Excel日期、YYYY/M/D、YYYY年M月D日。编号请保持文本格式以保留前导零。'],
      ['类型', '发明专利、实用新型、软件著作权、外观设计。'],
      ['取得方式', '原始取得、转让取得、许可取得。'],
      ['草稿与校验', '允许未填完整的草稿；已填写值必须有效，每个字段最多512字，不支持公式，请粘贴为值。仅支持不超过5MB的.xlsx文件。'],
    ]);
    instructions.getColumn(1).width = 20;
    instructions.getColumn(2).width = 110;
    for (const tab of workbook.worksheets) {
      tab.getRow(1).font = { bold: true };
      tab.eachRow((row) => row.eachCell((cell) => { cell.alignment = { vertical: 'top', wrapText: true }; }));
    }
    return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), filename: '项目详情表.xlsx' };
  }

  private mergeProjectDetailsCells(sheet: Worksheet) {
    const columns = [1, 2, 3, 4];
    for (let start = 2; start <= sheet.rowCount;) {
      const values = columns.map((column) => sheet.getCell(start, column).value);
      let end = start + 1;
      while (end <= sheet.rowCount && columns.every((column, index) => sheet.getCell(end, column).value === values[index])) end++;
      if (end - start > 1) {
        for (const column of columns) sheet.mergeCells(start, column, end - 1, column);
      }
      start = end;
    }
  }

  private ipCellText(cell: Cell, trim = true): { text: string; error?: string } {
    const value = cell.value;
    if (value === null || value === undefined) return { text: '' };
    if (typeof value === 'string') return { text: trim ? value.trim() : value };
    if (typeof value === 'number') {
      const format = cell.numFmt?.split(';')[0] ?? '';
      // A numeric cell can only recover leading zeros still recorded in its format.
      return { text: Number.isInteger(value) && value >= 0 && /^0+$/u.test(format)
        ? String(value).padStart(format.length, '0') : String(value) };
    }
    if (typeof value === 'boolean' || value instanceof Date) return { text: '[无效单元格]', error: '请使用文本，不支持日期/布尔值' };
    if ('formula' in value || 'sharedFormula' in value) return { text: '[公式]', error: '请粘贴为值后导入' };
    if ('richText' in value) {
      const text = value.richText.map((part) => part.text).join('');
      return { text: trim ? text.trim() : text };
    }
    if ('text' in value) return { text: trim ? value.text.trim() : value.text };
    return { text: '[无效单元格]', error: '单元格包含 Excel 错误值' };
  }

  private ipCellDate(cell: Cell, date1904 = false): { text: string; error?: string } {
    const value = cell.value;
    if (value instanceof Date) return { text: Number.isNaN(value.getTime()) ? '[无效日期]' : value.toISOString().slice(0, 10) };
    if (typeof value === 'number') {
      const serial = Math.floor(value);
      if (!Number.isFinite(value) || serial < 0 || serial > 2958465 || (!date1904 && serial === 60)) return { text: '[无效日期]' };
      const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
      const days = !date1904 && serial > 60 ? serial - 1 : serial;
      return { text: new Date(epoch + days * 86400000).toISOString().slice(0, 10) };
    }
    const parsed = this.ipCellText(cell);
    const match = /^(\d{4})(?:\/(\d{1,2})\/(\d{1,2})|年(\d{1,2})月(\d{1,2})日)$/u.exec(parsed.text);
    if (match) parsed.text = `${match[1]}-${(match[2] ?? match[4]).padStart(2, '0')}-${(match[3] ?? match[5]).padStart(2, '0')}`;
    return parsed;
  }

  /** Bound decompressed XLSX size before loading its XML, as in governance import. */
  private assertSafeZip(buffer: Buffer) {
    let end = -1;
    for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset--) {
      if (buffer.readUInt32LE(offset) === 0x06054b50 && offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length) { end = offset; break; }
    }
    if (end < 0) throw new BadRequestException('文件不是有效的 Excel 文件');
    const count = buffer.readUInt16LE(end + 10);
    let cursor = buffer.readUInt32LE(end + 16);
    let total = 0;
    if (count > 2000 || count === 0xffff) throw new BadRequestException('Excel 文件结构过大');
    for (let index = 0; index < count; index++) {
      if (cursor + 46 > end || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new BadRequestException('Excel 文件结构损坏');
      total += buffer.readUInt32LE(cursor + 24);
      if (total > 30 * 1024 * 1024) throw new BadRequestException('Excel 解压后超过30MB，请拆分或删除多余内容');
      cursor += 46 + buffer.readUInt16LE(cursor + 28) + buffer.readUInt16LE(cursor + 30) + buffer.readUInt16LE(cursor + 32);
    }
  }

  async exportIpSummary(userId: number, companyId: string, input: unknown) {
    await this.requireCompany(userId, companyId);
    const rows = input && typeof input === 'object' ? (input as { rows?: unknown }).rows : undefined;
    if (!Array.isArray(rows) || rows.length > 200) throw new BadRequestException('知识产权汇总须为列表，最多支持200条');
    // Export the editor snapshot, including incomplete rows, without saving the draft.
    const validatedRows = rows.map((row: unknown, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new BadRequestException(`第${index + 1}行数据格式不正确`);
      const record = {} as Omit<HighTechIpItem, 'id'>;
      for (const { key, label } of IP_SUMMARY_FIELDS) {
        const value = (row as Record<string, unknown>)[key] ?? '';
        if (typeof value !== 'string' || value.length > 512) throw new BadRequestException(`第${index + 1}行：${label}须为不超过512字的文本`);
        record[key] = value;
      }
      return record;
    });
    const values = sortIpSummaryRows(validatedRows).map((row, index) => IP_SUMMARY_FIELDS.map(({ key }) => key === 'number' ? `IP${String(index + 1).padStart(2, '0')}` : row[key]));
    const workbook = new Workbook();
    workbook.creator = 'HQX';
    const sheet = workbook.addWorksheet('专利证书');
    sheet.addRow(IP_SUMMARY_FIELDS.map(({ label }) => label));
    sheet.addRows(values);
    for (const [index, width] of [14, 38, 20, 17, 27, 38, 17, 17].entries()) {
      const column = sheet.getColumn(index + 1);
      column.width = width;
      column.numFmt = '@';
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.getRow(1).font = { bold: true };
    sheet.eachRow((row) => row.eachCell((cell) => { cell.alignment = { vertical: 'top', wrapText: true }; }));
    return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), filename: '知识产权汇总表.xlsx' };
  }

  async ipSummaryTemplate(userId: number, companyId: string) {
    await this.requireCompany(userId, companyId);
    const workbook = new Workbook();
    workbook.creator = 'HQX';
    const sheet = workbook.addWorksheet('专利证书');
    sheet.addRow(IP_SUMMARY_FIELDS.map(({ label }) => label));
    for (const [index, width] of [14, 38, 20, 17, 27, 38, 17, 17].entries()) sheet.getColumn(index + 1).width = width;
    sheet.getColumn(1).numFmt = '@';
    sheet.getColumn(5).numFmt = '@';
    sheet.getColumn(7).numFmt = 'yyyy-mm-dd';
    sheet.getColumn(8).numFmt = 'yyyy-mm-dd';
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    for (let row = 2; row <= 201; row++) {
      sheet.getCell(`C${row}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`"${IP_PATENT_TYPES.join(',')}"`], showErrorMessage: true, error: '请选择有效专利类型' };
      sheet.getCell(`D${row}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`"${IP_LEGAL_STATUSES.join(',')}"`], showErrorMessage: true, error: '请选择有效法律状态' };
    }
    const instructions = workbook.addWorksheet('填写说明');
    instructions.addRows(IP_TEMPLATE_INSTRUCTIONS);
    instructions.getColumn(1).width = 20;
    instructions.getColumn(2).width = 112;
    const examples = workbook.addWorksheet('填写示例');
    examples.addRow(IP_SUMMARY_FIELDS.map(({ label }) => label));
    examples.addRows(IP_TEMPLATE_EXAMPLES);
    sheet.columns.forEach((column, index) => { examples.getColumn(index + 1).width = column.width; });
    examples.getColumn(1).numFmt = '@';
    examples.getColumn(5).numFmt = '@';
    for (const tab of workbook.worksheets) {
      tab.getRow(1).font = { bold: true };
      tab.eachRow((row) => { row.eachCell((cell) => { cell.alignment = { vertical: 'top', wrapText: true }; }); });
    }
    return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), filename: '知识产权汇总表导入模板.xlsx' };
  }

  async export(userId: number, companyId: string) {
    const draft = await this.get(userId, companyId);
    normalizeHighTechDraft({ ...draft, currentStep: 2 });
    if (!draft.materials.some((item) => item.content)) throw new BadRequestException('请先制作并保存高新材料');
    const workbook = new Workbook();
    workbook.creator = 'HQX';
    const summary = workbook.addWorksheet('自评分');
    summary.addRow(['企业', draft.companyName]);
    summary.addRow(['说明', '内部自评与材料草稿，不代表认定结果；导出后请核对并补充证明附件。']);
    summary.addRow(['评分项目', '分数', '满分']);
    for (const field of SCORE_FIELDS) summary.addRow([field.label, draft.scores[field.key], field.max]);
    summary.addRow(['总分', Number(SCORE_FIELDS.reduce((sum, field) => sum + (draft.scores[field.key] ?? 0), 0).toFixed(2)), 100]);
    const ipSummary = workbook.addWorksheet('知识产权汇总表');
    ipSummary.addRow(IP_SUMMARY_FIELDS.map(({ label }) => label));
    for (const row of sortIpSummaryRows(draft.ipSummary)) ipSummary.addRow(IP_SUMMARY_FIELDS.map(({ key }) => row[key]));
    ipSummary.views = [{ state: 'frozen', ySplit: 1 }];
    ipSummary.autoFilter = { from: 'A1', to: 'H1' };
    IP_SUMMARY_FIELDS.forEach(({ key }, index) => { ipSummary.getColumn(index + 1).width = ['name', 'patentee'].includes(key) ? 30 : 22; });
    ipSummary.getColumn(1).numFmt = '@';
    ipSummary.getColumn(5).numFmt = '@';
    const projects = workbook.addWorksheet('项目详情表');
    projects.addRow(PROJECT_FIELDS.map((field) => field.label));
    for (const row of draft.projects) projects.addRow(PROJECT_FIELDS.map((field) => field.key === 'psNumber' && row.psName
      ? `${row.psNumber}\n${row.psName}` : row[field.key]));
    projects.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
    projects.autoFilter = { from: 'A1', to: 'N1' };
    this.mergeProjectDetailsCells(projects);
    for (const type of MATERIAL_TYPES) {
      const material = draft.materials.find((item) => item.key === type.key)!;
      const sheet = workbook.addWorksheet(type.title);
      sheet.addRow(['企业', draft.companyName]);
      sheet.addRow(['材料状态', material.reviewed ? '已人工核对（草稿）' : '待核对（草稿）']);
      sheet.addRow(['材料内容']);
      // Split paragraphs so long content remains visible rather than clipped in one cell.
      for (const line of material.content.split('\n')) sheet.addRow([line]);
      sheet.getColumn(1).width = 90;
      sheet.getColumn(2).width = 40;
    }
    for (const sheet of workbook.worksheets) {
      if (sheet === projects || sheet === summary) sheet.columns.forEach((column) => { column.width = 24; });
      sheet.eachRow((row) => {
        row.eachCell((cell) => { cell.alignment = { vertical: 'top', wrapText: true }; });
      });
      sheet.getRow(sheet === summary ? 3 : 1).font = { bold: true };
    }
    return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), filename: `${draft.companyName}-高新技术企业申报材料（草稿）.xlsx` };
  }
}
