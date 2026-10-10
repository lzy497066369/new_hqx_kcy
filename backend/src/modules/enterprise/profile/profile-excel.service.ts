import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Workbook, type CellValue, type Worksheet } from 'exceljs';
import { Repository } from 'typeorm';

import type { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { EnterpriseEntity } from '../../../infrastructure/database/entities/enterprise.entity';
import { EnterpriseInput } from './dto';
import { EnterpriseProfileService } from './profile.service';

const FIELDS = [
  'name',
  'shortName',
  'creditCode',
  'legalPerson',
  'contactName',
  'contactPhone',
  'contactEmail',
  'industry',
  'enterpriseType',
  'province',
  'city',
  'district',
  'address',
  'profileStatus',
  'status',
  'source',
  'remark',
] as const;

type Field = (typeof FIELDS)[number];
type ImportStatus = 'duplicate' | 'error' | 'success';

type ImportRow = {
  enterpriseId?: string;
  enterpriseName: string;
  issues: string[];
  rowNumber: number;
  status: ImportStatus;
};

type SourceRow = {
  enterpriseId?: string;
  rowNumber: number;
  values: Record<Field, string>;
  issues: string[];
  status: 'ready' | 'duplicate' | 'error' | 'success';
};

const LABELS: Record<Field, string> = {
  name: '企业名称',
  shortName: '企业简称',
  creditCode: '统一社会信用代码',
  legalPerson: '法人',
  contactName: '联系人',
  contactPhone: '联系电话',
  contactEmail: '联系邮箱',
  industry: '行业',
  enterpriseType: '企业类型',
  province: '省份',
  city: '城市',
  district: '区县',
  address: '详细地址',
  profileStatus: '资料状态',
  status: '启用状态',
  source: '来源',
  remark: '备注',
};

const ALIASES: Record<Field, string[]> = {
  name: ['企业名称', '公司名称', '企业全称', '公司全称'],
  shortName: ['企业简称', '公司简称'],
  creditCode: ['统一社会信用代码', '统一信用代码', '信用代码'],
  legalPerson: ['法人', '法定代表人', '法人代表'],
  contactName: ['联系人', '联系人姓名'],
  contactPhone: ['联系电话', '联系手机', '联系电话号码', '手机号码'],
  contactEmail: ['联系邮箱', '联系电子邮箱', '电子邮箱', '邮箱'],
  industry: ['行业', '所属行业'],
  enterpriseType: ['企业类型', '公司类型'],
  province: ['省份', '省'],
  city: ['城市', '市'],
  district: ['区县', '区', '县'],
  address: ['详细地址', '注册地址', '地址'],
  profileStatus: ['资料状态', '档案状态'],
  status: ['启用状态', '状态'],
  source: ['来源', '企业来源'],
  remark: ['备注', '说明'],
};

const REQUIRED_FIELDS: Field[] = [
  'name',
  'creditCode',
  'contactName',
  'contactPhone',
  'contactEmail',
];

const MAX_ROWS = 1000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const PROFILE_STATUS_LABELS: Record<string, string> = {
  草稿: 'draft',
  待审核: 'pending_review',
  已通过: 'approved',
  已驳回: 'rejected',
  待重提: 'need_resubmit',
};

const normalizeHeader = (value: string) =>
  value.replace(/[\s*＊（()）]/g, '').normalize('NFKC');

@Injectable()
export class EnterpriseProfileExcelService {
  private readonly logger = new Logger(EnterpriseProfileExcelService.name);

  constructor(
    @InjectRepository(EnterpriseEntity)
    private readonly enterpriseRepo: Repository<EnterpriseEntity>,
    private readonly profileService: EnterpriseProfileService,
  ) {}

  async export(user: CurrentUser, template = false): Promise<Buffer> {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet(template ? '企业档案模板' : '企业档案');
    sheet.columns = FIELDS.map((field) => ({
      header: LABELS[field],
      key: field,
      width: this.columnWidth(field),
    }));

    if (!template) {
      const result = await this.profileService.list({}, user);
      for (const row of result.items) {
        sheet.addRow({
          name: row.name,
          shortName: row.shortName ?? '',
          creditCode: row.creditCode,
          legalPerson: row.legalPerson ?? '',
          contactName: row.contactName ?? '',
          contactPhone: row.contactPhone ?? '',
          contactEmail: row.contactEmail ?? '',
          industry: row.industry ?? '',
          enterpriseType: row.enterpriseType ?? '',
          province: row.province ?? '',
          city: row.city ?? '',
          district: row.district ?? '',
          address: row.address ?? '',
          profileStatus: row.profileStatus,
          status: row.status,
          source: row.source ?? '',
          remark: row.remark ?? '',
        });
      }
    }

    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = `A1:${this.columnLetter(FIELDS.length)}1`;
    sheet.getRow(1).height = 30;
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF24539A' },
      };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });

    for (const field of ['creditCode', 'contactPhone', 'contactEmail']) {
      sheet.getColumn(FIELDS.indexOf(field as Field) + 1).numFmt = '@';
    }
    sheet.getColumn(FIELDS.indexOf('status') + 1).numFmt = '0';

    if (template) {
      sheet.getCell('A1').note =
        '必填字段：企业名称、统一社会信用代码、联系人、联系电话、联系邮箱。一行一家企业。';
      sheet.getCell('N1').note =
        '可填写：draft、pending_review、approved、rejected、need_resubmit；也可填写对应中文状态。';
      sheet.getCell('O1').note = '填写 1 表示启用，填写 0 表示禁用；留空默认为启用。';
      for (let row = 2; row <= MAX_ROWS + 1; row++) {
        sheet.getCell(row, FIELDS.indexOf('status') + 1).dataValidation = {
          type: 'whole',
          operator: 'between',
          allowBlank: true,
          formulae: [0, 1],
          showErrorMessage: true,
          errorTitle: '启用状态无效',
          error: '请填写 0 或 1',
        };
      }
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async import(
    user: CurrentUser,
    file: { originalname: string; buffer: Buffer } | undefined,
  ) {
    const sourceRows = await this.parse(file);
    const rows = await this.validate(sourceRows);

    for (const row of rows) {
      if (row.status !== 'ready') continue;
      try {
        const created = await this.profileService.create(
          this.toInput(row.values),
          user,
        );
        row.status = 'success';
        row.enterpriseId = created.id;
      } catch (error) {
        row.status = this.isDuplicateError(error) ? 'duplicate' : 'error';
        row.issues = [this.errorMessage(error)];
        if (row.status === 'error') {
          this.logger.error(
            `企业 Excel 导入第 ${row.rowNumber} 行失败`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    }

    const resultRows: ImportRow[] = rows.map((row) => ({
      enterpriseId: row.enterpriseId,
      enterpriseName: row.values.name,
      issues: row.issues,
      rowNumber: row.rowNumber,
      status: row.status === 'ready' ? 'error' : row.status,
    }));

    return {
      rows: resultRows,
      total: resultRows.length,
      success: resultRows.filter((row) => row.status === 'success').length,
      duplicate: resultRows.filter((row) => row.status === 'duplicate').length,
      failed: resultRows.filter((row) => row.status === 'error').length,
    };
  }

  private async parse(
    file: { originalname: string; buffer: Buffer } | undefined,
  ): Promise<SourceRow[]> {
    if (
      !file ||
      !/\.xlsx$/i.test(file.originalname) ||
      file.buffer.length > MAX_FILE_SIZE
    ) {
      throw new BadRequestException('请上传不超过 5MB 的 .xlsx 文件');
    }

    this.assertSafeZip(file.buffer);
    const workbook = new Workbook();
    try {
      await workbook.xlsx.load(
        file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
    } catch {
      throw new BadRequestException(
        '无法识别此 Excel，请确认文件未损坏、未加密，且确实为 .xlsx 格式',
      );
    }

    const sheets = workbook.worksheets.filter((sheet) => sheet.state === 'visible');
    if (!sheets.length || sheets.length > 20) {
      throw new BadRequestException('Excel 必须包含 1-20 个可见工作表');
    }

    const sheet = sheets.find((item) => item.name === '企业档案模板') ?? sheets[0];
    if (sheet.columnCount > 100) {
      throw new BadRequestException('工作表列数超过 100，请删除多余格式或空列');
    }

    const header = this.detectHeader(sheet);
    const missing = REQUIRED_FIELDS.filter((field) => !header.mapping[field]);
    if (missing.length) {
      throw new BadRequestException(
        `未识别必填列：${missing.map((field) => LABELS[field]).join('、')}`,
      );
    }

    const rows: SourceRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= header.row) return;
      const values = {} as Record<Field, string>;
      const issues: string[] = [];
      let hasValue = false;

      for (const field of FIELDS) {
        const column = header.mapping[field];
        const parsed = column
          ? this.cellText(row.getCell(column).value)
          : { text: '' };
        values[field] = parsed.text.slice(0, 512);
        if (parsed.text) hasValue = true;
        if (parsed.error) issues.push(`${LABELS[field]}：${parsed.error}`);
        if (parsed.text.length > 512) {
          issues.push(`${LABELS[field]}：单元格内容超过 512 字，请精简后导入`);
        }
      }

      if (!hasValue) return;
      if (rows.length >= MAX_ROWS) {
        throw new BadRequestException(`一次最多导入 ${MAX_ROWS} 家企业，请拆分文件`);
      }
      rows.push({ rowNumber, values, issues, status: 'ready' });
    });

    if (!rows.length) throw new BadRequestException('Excel 中没有可导入的数据行');
    return rows;
  }

  private async validate(sourceRows: SourceRow[]): Promise<SourceRow[]> {
    const existing = await this.enterpriseRepo.find({
      select: { creditCode: true },
    });
    const existingCodes = new Set(
      existing
        .map((item) => item.creditCode?.trim().toLocaleLowerCase())
        .filter((value): value is string => Boolean(value)),
    );
    const seenCodes = new Set<string>();

    return sourceRows.map((row) => {
      for (const field of REQUIRED_FIELDS) {
        if (!row.values[field].trim()) row.issues.push(`${LABELS[field]}必填`);
      }
      if (row.values.name && (row.values.name.length < 2 || row.values.name.length > 128)) {
        row.issues.push('企业名称需为 2-128 位');
      }
      if (row.values.creditCode && row.values.creditCode.length > 64) {
        row.issues.push('统一社会信用代码最多 64 位');
      }
      if (row.values.contactEmail && !/^\S+@\S+\.\S+$/.test(row.values.contactEmail)) {
        row.issues.push('联系邮箱格式不正确');
      }
      if (row.values.contactPhone && row.values.contactPhone.length > 32) {
        row.issues.push('联系电话最多 32 位');
      }

      const profileStatus = this.normalizeProfileStatus(row.values.profileStatus);
      if (row.values.profileStatus && !profileStatus) {
        row.issues.push('资料状态不合法');
      } else if (profileStatus) {
        row.values.profileStatus = profileStatus;
      }

      const status = this.normalizeStatus(row.values.status);
      if (row.values.status && status === undefined) {
        row.issues.push('启用状态只能填写 0、1、启用或禁用');
      } else if (status !== undefined) {
        row.values.status = String(status);
      }

      const code = row.values.creditCode.trim().toLocaleLowerCase();
      if (!row.issues.length && (existingCodes.has(code) || seenCodes.has(code))) {
        row.status = 'duplicate';
        row.issues = [
          existingCodes.has(code)
            ? '系统已有相同统一社会信用代码，跳过且不覆盖'
            : 'Excel 内统一社会信用代码重复，仅首条记录可导入',
        ];
      } else if (row.issues.length) {
        row.status = 'error';
      } else {
        seenCodes.add(code);
      }
      return row;
    });
  }

  private toInput(values: Record<Field, string>): EnterpriseInput {
    const input: EnterpriseInput = {
      name: values.name,
      creditCode: values.creditCode,
      contactName: values.contactName,
      contactPhone: values.contactPhone,
      contactEmail: values.contactEmail,
    };

    for (const field of FIELDS) {
      if (['name', 'creditCode', 'contactName', 'contactPhone', 'contactEmail'].includes(field)) continue;
      const value = values[field].trim();
      if (!value) continue;
      if (field === 'status') input.status = Number(value);
      else if (field === 'profileStatus') input.profileStatus = value;
      else (input as Record<string, string>)[field] = value;
    }
    return input;
  }

  private detectHeader(sheet: Worksheet) {
    let best = { row: 1, mapping: {} as Partial<Record<Field, number>> };
    for (let row = 1; row <= Math.min(sheet.rowCount, 30); row++) {
      const mapping = this.detectMapping(sheet, row);
      if (Object.keys(mapping).length > Object.keys(best.mapping).length) {
        best = { row, mapping };
      }
    }
    return best;
  }

  private detectMapping(sheet: Worksheet, rowNumber: number) {
    const mapping: Partial<Record<Field, number>> = {};
    for (const field of FIELDS) {
      const matches: number[] = [];
      sheet.getRow(rowNumber).eachCell((cell, column) => {
        if (
          column <= 100 &&
          ALIASES[field].some(
            (alias) =>
              normalizeHeader(alias) ===
              normalizeHeader(this.cellText(cell.value).text),
          )
        ) {
          matches.push(column);
        }
      });
      if (matches.length === 1) mapping[field] = matches[0];
    }
    return mapping;
  }

  private cellText(value: CellValue): { text: string; error?: string } {
    if (value === null || value === undefined) return { text: '' };
    if (typeof value === 'string' || typeof value === 'number') {
      return { text: String(value).trim() };
    }
    if (typeof value === 'boolean' || value instanceof Date) {
      return { text: String(value), error: '请使用文本值，不支持日期或布尔值' };
    }
    if ('formula' in value || 'sharedFormula' in value) {
      return { text: '[公式]', error: '不支持公式，请粘贴为值后导入' };
    }
    if ('richText' in value) {
      return { text: value.richText.map((part) => part.text).join('').trim() };
    }
    if ('text' in value) return { text: value.text.trim() };
    return { text: '[无效单元格]', error: '单元格包含 Excel 错误值' };
  }

  private normalizeProfileStatus(value: string): string | undefined {
    if (!value) return undefined;
    const normalized = PROFILE_STATUS_LABELS[value] ?? value;
    return [
      'draft',
      'pending_review',
      'approved',
      'rejected',
      'need_resubmit',
    ].includes(normalized)
      ? normalized
      : undefined;
  }

  private normalizeStatus(value: string): number | undefined {
    if (!value) return undefined;
    if (['启用', 'enabled'].includes(value.toLocaleLowerCase())) return 1;
    if (['禁用', 'disabled'].includes(value.toLocaleLowerCase())) return 0;
    if (value === '0' || value === '1') return Number(value);
    return undefined;
  }

  private isDuplicateError(error: unknown): boolean {
    return error instanceof ConflictException || error instanceof ForbiddenException && error.message.includes('已存在');
  }

  private errorMessage(error: unknown): string {
    if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof ForbiddenException) {
      return error.message;
    }
    return '服务异常，本行未导入，请稍后重新上传核对';
  }

  private columnWidth(field: Field): number {
    if (field === 'remark' || field === 'address') return 34;
    if (field === 'name' || field === 'shortName') return 26;
    if (field === 'contactEmail') return 28;
    return 20;
  }

  private columnLetter(column: number): string {
    let result = '';
    let value = column;
    while (value > 0) {
      const remainder = (value - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      value = Math.floor((value - 1) / 26);
    }
    return result;
  }

  private assertSafeZip(buffer: Buffer) {
    if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) {
      throw new BadRequestException('文件不是有效的 .xlsx 文件');
    }
  }
}
