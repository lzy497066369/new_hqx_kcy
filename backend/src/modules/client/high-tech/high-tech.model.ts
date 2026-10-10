import { normalizeWorkspace } from './material-workspace';
import type { MaterialWorkspace } from './material-workspace';
import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { NameGeneration, normalizeNameGeneration } from './high-tech-name-generation';
import { ATTACHMENT_SECTIONS, BOOK_SECTIONS, AttachmentKey, BookKey } from './high-tech-material-catalog';

export const SCORE_FIELDS = [
  { key: 'intellectualProperty', label: '知识产权', max: 30 },
  { key: 'transformation', label: '成果转化', max: 30 },
  { key: 'organization', label: '研发组织管理', max: 20 },
  { key: 'salesGrowth', label: '销售额增长率', max: 10 },
  { key: 'netAssetGrowth', label: '净资产增长率', max: 10 },
] as const;
export type ScoreKey = (typeof SCORE_FIELDS)[number]['key'];
export type HighTechScores = Record<ScoreKey, number | null>;

export const PROJECT_FIELDS = [
  { key: 'rdNumber', label: 'RD序号' },
  { key: 'year', label: '年份' },
  { key: 'activityName', label: '研发活动名称' },
  { key: 'researchPeriod', label: '研发周期' },
  { key: 'ipNumber', label: '对应知识产权序号' },
  { key: 'ipName', label: '知识产权名称' },
  { key: 'authorizationNumber', label: '授权号' },
  { key: 'applicationDate', label: '申请日期' },
  { key: 'authorizationDate', label: '授权日期' },
  { key: 'ipType', label: '类型' },
  { key: 'acquisitionMethod', label: '取得方式' },
  { key: 'psNumber', label: '对应PS' },
  { key: 'achievementNumber', label: '成果序号' },
  { key: 'achievementName', label: '成果名称' },
  { key: 'techField', label: '高新技术领域' },
] as const;
export type ProjectField = (typeof PROJECT_FIELDS)[number]['key'];
export type HighTechProject = Record<Exclude<ProjectField, 'year'>, string> & {
  id: string;
  year: number | null;
  psName?: string;
};
export const IP_SUMMARY_FIELDS = [
  { key: 'number', label: '编号' },
  { key: 'name', label: '名称' },
  { key: 'patentType', label: '专利类型' },
  { key: 'legalStatus', label: '法律状态' },
  { key: 'patentNumber', label: '专利号' },
  { key: 'patentee', label: '专利权人' },
  { key: 'applicationDate', label: '申请日期' },
  { key: 'grantDate', label: '授权日期' },
] as const;
export type HighTechIpItem = Record<(typeof IP_SUMMARY_FIELDS)[number]['key'], string> & { id: string };
export const IP_PATENT_TYPES = ['发明专利', '实用新型', '软件著作权', '外观设计'];

/** Sort the summary without changing row contents, numbering, or the source array. */
export function sortIpSummaryRows<T extends Pick<HighTechIpItem, 'patentType' | 'applicationDate'>>(
  rows: readonly T[],
): T[] {
  return rows.map((row, index) => {
    const typeIndex = IP_PATENT_TYPES.indexOf(row.patentType.trim());
    const value = row.applicationDate.trim();
    const timestamp = Date.parse(value);
    const validDate = /^\d{4}-\d{2}-\d{2}$/u.test(value)
      && Number.isFinite(timestamp)
      && new Date(timestamp).toISOString().slice(0, 10) === value;
    return {
      row,
      index,
      typeOrder: typeIndex < 0 ? IP_PATENT_TYPES.length : typeIndex,
      dateOrder: validDate ? timestamp : Number.MAX_SAFE_INTEGER,
    };
  }).sort((a, b) => a.typeOrder - b.typeOrder || a.dateOrder - b.dateOrder || a.index - b.index)
    .map(({ row }) => row);
}

export function synchronizeIpNumbers(draft: Pick<HighTechDraft, 'ipSummary' | 'projects'>): void {
  const counts = new Map<string, number>();
  for (const row of draft.ipSummary) {
    const old = row.number.trim();
    if (old) counts.set(old, (counts.get(old) ?? 0) + 1);
  }
  const replacements = new Map<string, string>();
  draft.ipSummary = sortIpSummaryRows(draft.ipSummary);
  draft.ipSummary.forEach((row, index) => {
    const old = row.number.trim();
    const next = `IP${String(index + 1).padStart(2, '0')}`;
    if (old && counts.get(old) === 1) replacements.set(old, next);
    row.number = next;
  });
  for (const project of draft.projects) {
    project.ipNumber = project.ipNumber.replace(/[^、,，;；\s]+/gu, (part) => replacements.get(part) ?? part);
  }
}

export const IP_LEGAL_STATUSES = ['授权', '申请中', '失效', '终止', '驳回', '撤回'];
export const MATERIAL_TYPES = [
  { key: 'research', title: '研发活动说明' },
  { key: 'property', title: '知识产权说明' },
  { key: 'transformation', title: '科技成果转化说明' },
  { key: 'organization', title: '研发组织管理说明' },
  { key: 'growth', title: '企业成长性说明' },
] as const;
export type HighTechMaterial = {
  key: (typeof MATERIAL_TYPES)[number]['key'];
  content: string;
  reviewed: boolean;
};
export interface HighTechBasicInfo {
  salesRevenue: number | null;
  employeeCount: number | null;
  insuredEmployeeCount: number | null;
  patentCount: number | null;
  inventionPatentCount: number | null;
  utilityModelCount: number | null;
  softwareCopyrightCount: number | null;
  hasRdExpenses: boolean | null;
}
export interface HighTechDraft {
  workspace?: MaterialWorkspace;
  basicInfo: HighTechBasicInfo;
  currentStep: number;
  scores: HighTechScores;
  projects: HighTechProject[];
  ipSummary: HighTechIpItem[];
  materials: HighTechMaterial[];
  book: { key: BookKey; content: string; reviewed: boolean }[];
  attachments: { key: AttachmentKey; note: string; content: string; reviewed: boolean }[];
  nameGeneration?: NameGeneration;
}

export const BASIC_INFO_FIELDS = [
  { key: 'salesRevenue', label: '企业销售额', unit: '万元', precision: 2 },
  { key: 'employeeCount', label: '企业人数', unit: '人', precision: 0 },
  { key: 'insuredEmployeeCount', label: '其中缴纳社保人数', unit: '人', precision: 0 },
  { key: 'patentCount', label: '专利数量', unit: '项', precision: 0 },
  { key: 'inventionPatentCount', label: '其中发明专利', unit: '项', precision: 0 },
  { key: 'utilityModelCount', label: '其中实用新型', unit: '项', precision: 0 },
  { key: 'softwareCopyrightCount', label: '其中软件著作权', unit: '项', precision: 0 },
] as const;
export function emptyBasicInfo(): HighTechBasicInfo {
  return {
    salesRevenue: null,
    employeeCount: null,
    insuredEmployeeCount: null,
    patentCount: null,
    inventionPatentCount: null,
    utilityModelCount: null,
    softwareCopyrightCount: null,
    hasRdExpenses: null,
  };
}
export function basicInfoErrors(info: HighTechBasicInfo) {
  const errors: Partial<Record<keyof HighTechBasicInfo, string>> = {};
  for (const { key, label, precision } of BASIC_INFO_FIELDS) {
    const value = info[key];
    if (value === null || value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
        (precision === 0 && !Number.isSafeInteger(value))) {
      errors[key] = `${label}须为非负${precision === 0 ? '整数' : '数字'}`;
    }
  }
  if (!errors.employeeCount && !errors.insuredEmployeeCount &&
      info.employeeCount != null && info.insuredEmployeeCount != null &&
      info.insuredEmployeeCount > info.employeeCount) {
    errors.insuredEmployeeCount = '缴纳社保人数不能超过企业人数';
  }
  if (info.hasRdExpenses != null && typeof info.hasRdExpenses !== 'boolean') {
    errors.hasRdExpenses = '请选择是否有研发费用';
  }
  return errors;
}

export function emptyHighTechDraft(now = new Date()): HighTechDraft {
  const currentYear = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(now));
  const projectCount = 9;
  const branchesPerProject = 2;
  return {
    currentStep: 0,
    basicInfo: emptyBasicInfo(),
    ipSummary: [],
    scores: { intellectualProperty: null, transformation: null, organization: null, salesGrowth: null, netAssetGrowth: null },
    projects: Array.from({ length: projectCount * branchesPerProject }, (_, rowIndex) => {
      const index = Math.floor(rowIndex / branchesPerProject);
      const year = currentYear - 3 + Math.floor(index / 3);
      const countInYear = Math.min(3, projectCount - Math.floor(index / 3) * 3);
      const startMonth = countInYear === 1 ? 1 : 1 + Math.round((index % 3) * 4 / (countInYear - 1));
      const endMonth = countInYear === 1 ? 12 : startMonth + 7;
      const start = new Date(Date.UTC(year, startMonth - 1, 1)).toISOString().slice(0, 10);
      const end = new Date(Date.UTC(year, endMonth, 0)).toISOString().slice(0, 10);
      return {
        id: randomUUID(),
        rdNumber: `RD${String(index + 1).padStart(2, '0')}`,
        year,
        activityName: '',
        researchPeriod: `${start}—${end}`,
        ipNumber: '',
        ipName: '',
        authorizationNumber: '',
        applicationDate: '',
        authorizationDate: '',
        ipType: '',
        acquisitionMethod: '',
        psNumber: '',
        achievementNumber: `成果${String(rowIndex + 1).padStart(2, '0')}`,
        achievementName: '',
        techField: '',
      };
    }),
    materials: MATERIAL_TYPES.map(({ key }) => ({ key, content: '', reviewed: false })),
    book: BOOK_SECTIONS.map(({ key }) => ({ key, content: '', reviewed: false })),
    attachments: ATTACHMENT_SECTIONS.map(({ key }) => ({ key, note: '', content: '', reviewed: false })),
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('申报草稿格式不正确');
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max = 512): string {
  if (typeof value !== 'string' || value.length > max) throw new BadRequestException(`${label}必须为不超过${max}字的文本`);
  return value.trim();
}
function date(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function ipItemErrors(row: HighTechIpItem): string[] {
  const errors: string[] = [];
  for (const { key, label } of IP_SUMMARY_FIELDS) {
    if (key !== 'number' && !row[key].trim()) errors.push(`请填写${label}`);
    if (row[key].length > 512) errors.push(`${label}须为不超过512字的文本`);
  }
  if (row.patentType && !IP_PATENT_TYPES.includes(row.patentType)) errors.push('专利类型不正确');
  if (row.legalStatus && !IP_LEGAL_STATUSES.includes(row.legalStatus)) errors.push('法律状态不正确');
  if (row.grantDate && !date(row.grantDate)) errors.push('授权日期不正确');
  if (row.applicationDate && !date(row.applicationDate)) errors.push('申请日期不正确');
  if (date(row.grantDate) && date(row.applicationDate) && row.grantDate < row.applicationDate) errors.push('授权日期不得早于申请日期');
  return errors;
}

export function normalizeHighTechScores(input: unknown, requireComplete = false): HighTechScores {
  const source = object(input);
  const scores = emptyHighTechDraft().scores;
  for (const { key, label, max } of SCORE_FIELDS) {
    const value = source[key];
    if (requireComplete && (value === null || value === undefined)) throw new BadRequestException(`请填写${label}分数`);
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max)) {
      throw new BadRequestException(`${label}分数须在0至${max}分之间`);
    }
    scores[key] = value as number | null;
  }
  return scores;
}

export function completedHighTechSelfScore(input: unknown): number | null {
  try {
    const scores = normalizeHighTechScores(input, true);
    return Math.round(SCORE_FIELDS.reduce((sum, { key }) => sum + scores[key]!, 0) * 10) / 10;
  } catch {
    return null;
  }
}

/** Validate even draft saves; never trust browser score limits or company IDs. */
export function normalizeHighTechDraft(input: unknown): HighTechDraft & { revision: number } {
  const body = object(input);
  if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0) throw new BadRequestException('草稿版本不正确');
  if (![0, 1, 2].includes(body.currentStep as number)) throw new BadRequestException('申报步骤不正确');
  const result = emptyHighTechDraft();
  result.currentStep = body.currentStep as number;
  if (body.basicInfo !== undefined) {
    const basicInfo = object(body.basicInfo);
    for (const { key } of BASIC_INFO_FIELDS) {
      result.basicInfo[key] = (basicInfo[key] === undefined ? null : basicInfo[key]) as number | null;
    }
    result.basicInfo.hasRdExpenses = (basicInfo.hasRdExpenses === undefined ? null : basicInfo.hasRdExpenses) as boolean | null;
    const error = Object.values(basicInfoErrors(result.basicInfo))[0];
    if (error) throw new BadRequestException(error);
  }
  result.scores = normalizeHighTechScores(body.scores);
  if (!Array.isArray(body.projects) || body.projects.length > 200) throw new BadRequestException('项目详情最多支持200条');
  const ids = new Set<string>();
  result.projects = body.projects.map((value, index) => {
    const source = object(value);
    const ipKeys = ['ipNumber', 'ipName', 'authorizationNumber', 'applicationDate', 'authorizationDate', 'ipType'];
    const hasIp = ipKeys.some((key) => typeof source[key] === 'string' && String(source[key]).trim());
    const row = { id: text(source.id, '项目标识', 64) } as HighTechProject;
    if (!row.id || ids.has(row.id)) throw new BadRequestException('项目行标识为空或重复');
    ids.add(row.id);
    for (const field of PROJECT_FIELDS) {
      if (field.key === 'year') {
        if (source.year !== null && (!Number.isInteger(source.year) || Number(source.year) < 1900 || Number(source.year) > 2100)) {
          throw new BadRequestException(`第${index + 1}行年份须为1900至2100之间的整数`);
        }
        row.year = source.year as number | null;
      } else {
        const value = field.key === 'applicationDate' && source[field.key] === undefined ? '' : source[field.key];
        row[field.key] = text(value, field.label);
      }
      if (field.key !== 'applicationDate' && result.currentStep >= 2 && (hasIp || (!ipKeys.includes(field.key) && field.key !== 'acquisitionMethod')) && (row[field.key] === '' || row[field.key] === null)) {
        throw new BadRequestException(`请填写第${index + 1}行的${field.label}`);
      }
    }
    if (!row.ipNumber) row.acquisitionMethod = '';
    if (row.applicationDate && !date(row.applicationDate)) throw new BadRequestException(`第${index + 1}行申请日期不正确`);
    if (row.authorizationDate && !date(row.authorizationDate)) throw new BadRequestException(`第${index + 1}行授权日期不正确`);
    if (row.applicationDate && row.authorizationDate && row.authorizationDate < row.applicationDate) throw new BadRequestException(`第${index + 1}行授权日期不得早于申请日期`);
    if (source.psName !== undefined) row.psName = text(source.psName, 'PS名称');
    return row;
  });
  if (result.currentStep >= 2 && !result.projects.length) throw new BadRequestException('请至少添加一条项目详情');
  const ipSummary = body.ipSummary === undefined ? [] : body.ipSummary;
  if (!Array.isArray(ipSummary) || ipSummary.length > 200) throw new BadRequestException('知识产权汇总最多支持200条');
  const ipIds = new Set<string>();
  result.ipSummary = ipSummary.map((value, index) => {
    const source = object(value);
    const row = { id: text(source.id, `第${index + 1}行知识产权标识`, 64) } as HighTechIpItem;
    if (!row.id || ipIds.has(row.id)) throw new BadRequestException('知识产权行标识为空或重复');
    ipIds.add(row.id);
    for (const { key, label } of IP_SUMMARY_FIELDS) row[key] = text(source[key], `第${index + 1}行：${label}`);
    const errors = ipItemErrors(row);
    if (errors.length) throw new BadRequestException(`第${index + 1}行：${errors[0]}`);
    return row;
  });
  if (!Array.isArray(body.materials) || body.materials.length !== MATERIAL_TYPES.length) throw new BadRequestException('材料类型不完整');
  result.materials = MATERIAL_TYPES.map(({ key }) => {
    const entries = (body.materials as unknown[]).map(object).filter((item) => item.key === key);
    if (entries.length !== 1) throw new BadRequestException('材料类型重复或缺失');
    const entry = entries[0];
    const content = text(entry.content, '材料内容', 20000);
    if (typeof entry.reviewed !== 'boolean' || (entry.reviewed && (!content || /【待补充[^】]*】/u.test(content)))) throw new BadRequestException('请先补齐材料和待补充内容再标记已核对');
    return { key, content, reviewed: entry.reviewed };
  });
  const book = body.book === undefined ? [] : body.book;
  if (!Array.isArray(book) || book.length > BOOK_SECTIONS.length) throw new BadRequestException('申请书栏目不正确');
  for (const entry of book) {
    const value = object(entry);
    if (!BOOK_SECTIONS.some(({ key }) => key === value.key) || book.filter((item) => object(item).key === value.key).length !== 1) throw new BadRequestException('申请书栏目重复或无效');
    if (typeof value.reviewed !== 'boolean') throw new BadRequestException('申请书核对状态不正确');
    const content = text(value.content, '申请书内容', 20000);
    if (value.reviewed && (!content || /【待补充[^】]*】/u.test(content))) throw new BadRequestException('请补齐申请书内容再标记已核对');
    result.book.find((item) => item.key === value.key)!.content = content;
    result.book.find((item) => item.key === value.key)!.reviewed = value.reviewed;
  }
  const attachments = body.attachments === undefined ? [] : body.attachments;
  if (!Array.isArray(attachments) || attachments.length > ATTACHMENT_SECTIONS.length) throw new BadRequestException('附件目录不正确');
  for (const entry of attachments) {
    const value = object(entry);
    if (!ATTACHMENT_SECTIONS.some(({ key }) => key === value.key) || attachments.filter((item) => object(item).key === value.key).length !== 1) throw new BadRequestException('附件目录重复或无效');
    const item = result.attachments.find((item) => item.key === value.key)!;
    item.note = text(value.note, '附件说明', 20000);
    item.content = text(value.content === undefined ? '' : value.content, '附件正文', 20000);
    item.reviewed = value.reviewed === undefined ? false : value.reviewed as boolean;
    if (typeof item.reviewed !== 'boolean' || (item.reviewed && (!item.content || /【待补充[^】]*】/u.test(item.content)))) {
      throw new BadRequestException('请补齐附件正文后再标记已核对');
    }
  }
  if (body.workspace !== undefined) {
    try { result.workspace = normalizeWorkspace(body.workspace); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : '材料草稿格式错误'); }
  }
  synchronizeIpNumbers(result);
  if (body.nameGeneration !== undefined) {
    try {
      result.nameGeneration = normalizeNameGeneration(body.nameGeneration, result.projects);
    } catch (error) {
      throw new BadRequestException(`名称生成记录不正确：${error instanceof Error ? error.message : '格式错误'}`);
    }
  }
  return { ...result, revision: body.revision as number };
}
