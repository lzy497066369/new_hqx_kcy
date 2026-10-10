import type {
  HighTechBasicInfo,
  HighTechDraft,
  HighTechIpItem,
  HighTechMaterial,
  HighTechProject,
  HighTechScores,
  BookKey,
  AttachmentKey,
} from '#/api/client/high-tech';

import { assignMissingResearchPeriods } from './research-period';

export const BOOK_SECTIONS: { key: BookKey; title: string }[] = [
  { key: 'profile', title: '企业简介' },
  { key: 'main', title: '一、主要情况' },
  { key: 'ip', title: '二、知识产权汇总表' },
  { key: 'hr', title: '三、人力资源情况表' },
  { key: 'rd', title: '四、企业研究开发活动情况表（近三年）' },
  { key: 'fee', title: '五、研发费用结构明细' },
  { key: 'ps', title: '六、上年度高新技术产品（服务）情况表' },
  { key: 'innovation_ip', title: '七、企业创新能力：知识产权竞争力' },
  { key: 'innovation_transform', title: '七、企业创新能力：科技成果转化' },
  { key: 'innovation_organization', title: '七、企业创新能力：研发组织管理' },
  { key: 'innovation_staff', title: '七、企业创新能力：管理与科技人员' },
  { key: 'standards', title: '八、标准制定加分项' },
];
export const ATTACHMENT_SECTIONS: { key: AttachmentKey; title: string }[] = [
  { key: 'cover', title: '申请书封皮' },
  { key: 'application_pdf', title: '高新技术企业认定申请书' },
  { key: 'business_license', title: '企业营业执照' },
  { key: 'ip', title: 'IP（知识产权）相关材料' },
  { key: 'staff_statement', title: '企业人员相关资料' },
  { key: 'rd_project_table', title: 'RD（研究开发活动）相关资料' },
  { key: 'rd_expense_audit', title: '近三年研发费用专项审计报告' },
  { key: 'hitech_products', title: 'PS（高新产品/服务）相关资料' },
  { key: 'hitech_income_audit', title: '近一年高新产品/服务收入专项审计报告' },
  { key: 'achievement_transform', title: '科技成果转化说明材料' },
  { key: 'system_docs', title: '研究开发组织管理水平证明材料' },
  { key: 'annual_audit', title: '财务审计报表' },
  { key: 'tax_settlement', title: '企业所得税纳税申报表其他说明材料' },
  { key: 'commitment', title: '国家网告知承诺书' },
];
export const GENERATABLE_ATTACHMENT_KEYS: AttachmentKey[] = [
  'staff_statement', 'rd_project_table', 'hitech_products', 'achievement_transform', 'system_docs',
];

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

export const SCORE_FIELDS: {
  key: keyof HighTechScores;
  label: string;
  max: number;
}[] = [
  { key: 'intellectualProperty', label: '知识产权', max: 30 },
  { key: 'transformation', label: '成果转化', max: 30 },
  { key: 'organization', label: '研发组织管理', max: 20 },
  { key: 'salesGrowth', label: '销售额增长率', max: 10 },
  { key: 'netAssetGrowth', label: '净资产增长率', max: 10 },
];
export const PROJECT_FIELDS: {
  key: Exclude<keyof HighTechProject, 'id'>;
  label: string;
  example: string;
  width: number;
}[] = [
  { key: 'rdNumber', label: 'RD序号', example: 'RD01', width: 110 },
  { key: 'year', label: '年份', example: '2026', width: 90 },
  {
    key: 'activityName',
    label: '研发活动名称',
    example: '填写研发活动名称',
    width: 220,
  },
  {
    key: 'researchPeriod',
    label: '研发周期',
    example: '2023-01-01—2023-08-31',
    width: 290,
  },
  { key: 'ipNumber', label: '对应知识产权序号', example: 'IP01', width: 170 },
  {
    key: 'ipName',
    label: '知识产权名称',
    example: '填写知识产权名称',
    width: 220,
  },
  {
    key: 'authorizationNumber',
    label: '授权号',
    example: '填写授权号',
    width: 190,
  },
  { key: 'applicationDate', label: '申请日期', example: '', width: 140 },
  { key: 'authorizationDate', label: '授权日期', example: '', width: 140 },
  {
    key: 'ipType',
    label: '类型',
    example: '选择类型',
    width: 140,
  },
  {
    key: 'acquisitionMethod',
    label: '取得方式',
    example: '选择取得方式',
    width: 140,
  },
  { key: 'psNumber', label: '对应PS', example: 'PS01', width: 320 },
  { key: 'achievementNumber', label: '成果序号', example: '成果01', width: 120 },
  {
    key: 'achievementName',
    label: '成果名称',
    example: '填写成果名称',
    width: 220,
  },
  {
    key: 'techField',
    label: '高新技术领域',
    example: '填写项目所属高新技术领域',
    width: 200,
  },
];
export const PROJECT_IP_TYPES = ['发明专利', '实用新型', '软件著作权', '外观设计'];
export const PROJECT_ACQUISITION_METHODS = ['原始取得', '转让取得', '许可取得'];
export const MATERIAL_CONTENT_LIMIT = 20_000;
export const IP_SUMMARY_FIELDS: {
  key: Exclude<keyof HighTechIpItem, 'id'>;
  label: string;
  example: string;
  width: number;
}[] = [
  { key: 'number', label: '编号', example: 'IP01', width: 110 },
  { key: 'name', label: '名称', example: '知识产权名称', width: 240 },
  { key: 'patentType', label: '专利类型', example: '', width: 150 },
  { key: 'legalStatus', label: '法律状态', example: '', width: 130 },
  { key: 'patentNumber', label: '专利号', example: '专利号或登记号', width: 220 },
  { key: 'patentee', label: '专利权人', example: '专利权人或著作权人', width: 240 },
  { key: 'applicationDate', label: '申请日期', example: '', width: 180 },
  { key: 'grantDate', label: '授权日期', example: '', width: 180 },
];
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
export const MATERIAL_TYPES: {
  key: HighTechMaterial['key'];
  title: string;
  hint: string;
}[] = [
  {
    key: 'research',
    title: '研发活动说明',
    hint: '补充立项目标、核心技术、创新点、实施进度和研发成果。',
  },
  {
    key: 'property',
    title: '知识产权说明',
    hint: '核对知识产权权属、有效状态及对产品核心技术的支持作用。',
  },
  {
    key: 'transformation',
    title: '科技成果转化说明',
    hint: '补充成果转化方式、应用情况及对应合同、发票等证明材料。',
  },
  {
    key: 'organization',
    title: '研发组织管理说明',
    hint: '补充研发管理制度、研发投入核算、人员与组织情况。',
  },
  {
    key: 'growth',
    title: '企业成长性说明',
    hint: '补充销售额、净资产数据、增长率计算过程及对应财务资料。',
  },
];
export function isHighTechProject(project: string) {
  return project.includes('高新技术企业');
}
function beijingYear(now = new Date()) {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
    }).format(now),
  );
}
export const DEFAULT_PROJECT_BRANCH_COUNT = 2;

export function emptyDraft(now = new Date()): HighTechDraft {
  const firstYear = beijingYear(now) - 3;
  const projects: HighTechProject[] = [];
  for (let index = 0; index < 9; index++)
    projects.push(...newProjectBranches(projects, firstYear + Math.floor(index / 3)));
  assignMissingResearchPeriods(projects);
  return {
    currentStep: 0,
    revision: 0,
    basicInfo: emptyBasicInfo(),
    scores: {
      intellectualProperty: null,
      transformation: null,
      organization: null,
      salesGrowth: null,
      netAssetGrowth: null,
    },
    projects,
    ipSummary: [],
    book: BOOK_SECTIONS.map(({ key }) => ({ key, content: '', reviewed: false })),
    attachments: ATTACHMENT_SECTIONS.map(({ key }) => ({ key, note: '', content: '', reviewed: false })),
    materials: MATERIAL_TYPES.map(({ key }) => ({
      key,
      content: '',
      reviewed: false,
    })),
  };
}
function defaultProjectYear(rows: HighTechProject[]): number {
  const last = rows[rows.length - 1];
  return last && typeof last.year === 'number' && Number.isInteger(last.year)
    ? last.year
    : beijingYear();
}
export function newProject(
  rows: HighTechProject[],
  year = defaultProjectYear(rows),
): HighTechProject {
  let sequence = 1;
  while (
    rows.some(
      (row) => row.rdNumber === `RD${String(sequence).padStart(2, '0')}`,
    )
  )
    sequence++;
  return {
    id: crypto.randomUUID(),
    rdNumber: `RD${String(sequence).padStart(2, '0')}`,
    year,
    activityName: '',
    researchPeriod: '',
    ipNumber: '',
    ipName: '',
    authorizationNumber: '',
    applicationDate: '',
    authorizationDate: '',
    ipType: '',
    acquisitionMethod: '',
    psNumber: '',
    achievementNumber: `成果${String(rows.length + 1).padStart(2, '0')}`,
    achievementName: '',
    techField: '',
  };
}
/** Create one RD with its default branches and independent achievement rows. */
export function newProjectBranches(
  rows: HighTechProject[],
  year = defaultProjectYear(rows),
): HighTechProject[] {
  const project = newProject(rows, year);
  return Array.from({ length: DEFAULT_PROJECT_BRANCH_COUNT }, (_, index) => ({
    ...project,
    id: index === 0 ? project.id : crypto.randomUUID(),
    achievementNumber: `成果${String(rows.length + index + 1).padStart(2, '0')}`,
  }));
}

export function totalScore(scores: HighTechScores) {
  return Number(
    SCORE_FIELDS.reduce(
      (sum, field) =>
        sum +
        (Number.isFinite(scores[field.key]) ? (scores[field.key] ?? 0) : 0),
      0,
    ).toFixed(2),
  );
}
export function newIpItem(rows: HighTechIpItem[]): HighTechIpItem {
  let sequence = 1;
  while (rows.some((row) => row.number === `IP${String(sequence).padStart(2, '0')}`))
    sequence++;
  return {
    id: crypto.randomUUID(),
    number: `IP${String(sequence).padStart(2, '0')}`,
    name: '',
    patentType: '',
    legalStatus: '',
    patentNumber: '',
    patentee: '',
    grantDate: '',
    applicationDate: '',
  };
}
export function ipSummaryError(items: HighTechIpItem[]): string {
  if (items.length > 200) return '知识产权汇总最多支持200条';
  const ids = new Set<string>();
  const validDate = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/u.test(date) &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
  for (const [index, row] of items.entries()) {
    const error = (text: string) => `第${index + 1}行：${text}`;
    if (!row.id.trim() || row.id.trim().length > 64 || ids.has(row.id.trim()))
      return error('知识产权行标识为空或重复');
    ids.add(row.id.trim());
    for (const { key, label } of IP_SUMMARY_FIELDS) {
      if (typeof row[key] !== 'string' || row[key].length > 512)
        return error(`${label}须为不超过512字的文本`);
      if (key !== 'number' && !row[key].trim())
        return error(`请填写${label}`);
    }
    if (!IP_PATENT_TYPES.includes(row.patentType.trim())) return error('专利类型不正确');
    if (!IP_LEGAL_STATUSES.includes(row.legalStatus.trim())) return error('法律状态不正确');
    const grantDate = row.grantDate.trim();
    const applicationDate = row.applicationDate.trim();
    if (grantDate && !validDate(grantDate)) return error('授权日期不正确');
    if (applicationDate && !validDate(applicationDate)) return error('申请日期不正确');
    if (grantDate && applicationDate && grantDate < applicationDate)
      return error('授权日期不得早于申请日期');
  }
  return '';
}
export function scoreError(scores: HighTechScores) {
  for (const { key, label, max } of SCORE_FIELDS) {
    const value = scores[key];
    if (value === null || value === undefined)
      return `请填写${label}分数（0—${max}分）`;
    if (!Number.isFinite(value) || value < 0 || value > max)
      return `${label}分数须在0至${max}分之间`;
  }
  return '';
}
export function projectError(project: HighTechProject) {
  const ipFields = ['ipNumber', 'ipName', 'authorizationNumber', 'applicationDate', 'authorizationDate', 'ipType'];
  const hasIp = ipFields.some((key) => String(project[key as keyof HighTechProject] ?? '').trim());
  for (const field of PROJECT_FIELDS) {
    if (field.key === 'applicationDate') continue; // Older drafts may not have an application date.
    if (!hasIp && (ipFields.includes(field.key) || field.key === 'acquisitionMethod')) continue;
    if (project[field.key] == null || String(project[field.key]).trim() === '')
      return `请填写${field.label}`;
  }
  if (
    !Number.isInteger(project.year) ||
    Number(project.year) < 1900 ||
    Number(project.year) > 2100
  )
    return '年份须为1900至2100之间的整数';
  const applicationDate = project.applicationDate;
  if (applicationDate && (!/^\d{4}-\d{2}-\d{2}$/u.test(applicationDate) || !Number.isFinite(Date.parse(applicationDate)) || new Date(applicationDate).toISOString().slice(0, 10) !== applicationDate))
    return '请填写有效的申请日期';
  const date = project.authorizationDate;
  if (
    hasIp && (
      !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
      Number.isNaN(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date)
  )
    return '请填写有效的授权日期';
  if (applicationDate && date && applicationDate > date)
    return '授权日期不得早于申请日期';
  return '';
}
export function stepError(draft: HighTechDraft, target: number) {
  const basicError = Object.values(basicInfoErrors(draft.basicInfo))[0];
  if (basicError) return basicError;
  if (target >= 2) {
    const ipError = ipSummaryError(draft.ipSummary ?? []);
    if (ipError) return ipError;
    if (!draft.projects.length) return '请至少添加一条项目详情';
    for (const [index, row] of draft.projects.entries()) {
      const error = projectError(row);
      if (error) return `第${index + 1}行：${error}`;
    }
  }
  return '';
}
export function hasPlaceholders(content: string) {
  return /【待补充[^】]*】/u.test(content);
}

/** Assemble editable outlines from supplied facts only. This is not AI or an official filing. */
export function buildMaterialContent(
  key: HighTechMaterial['key'],
  companyName: string,
  draft: HighTechDraft,
): string {
  const rows = draft.projects;
  const heading = `${companyName}\n${MATERIAL_TYPES.find((item) => item.key === key)?.title}\n（内部草稿，请核对并补齐证明附件）\n\n`;
  switch (key) {
    case 'research':
      return (
        heading +
        rows
          .map(
            (row) =>
              `${row.rdNumber}｜${row.activityName}\n年份：${row.year}；研发周期：${row.researchPeriod}\n高新技术领域：${row.techField}\n对应PS：${row.psNumber}\n【待补充：立项目标、核心技术、创新点、实施进度、研发成果及证明材料】`,
          )
          .join('\n\n')
      );
    case 'property':
      return (
        heading +
        rows
          .filter((row) => row.ipNumber.trim() || row.ipName.trim() || row.authorizationNumber.trim())
          .map(
            (row) =>
              `${row.ipNumber}｜${row.ipName}\n授权号：${row.authorizationNumber}；授权日期：${row.authorizationDate}\n类型：${row.ipType}；取得方式：${row.acquisitionMethod}\n对应研发活动：${row.rdNumber}；对应PS：${row.psNumber}\n【待补充：权利人、有效状态、核心技术支持作用及权属证明】`,
          )
          .join('\n\n')
      );
    case 'transformation':
      return (
        heading +
        rows
          .map(
            (row) =>
              `${row.achievementNumber}｜${row.achievementName}\n对应研发活动：${row.rdNumber}；对应知识产权：${row.ipNumber}；对应PS：${row.psNumber}\n【待补充：转化方式、转化时间、应用情况及证明材料】`,
          )
          .join('\n\n')
      );
    case 'organization':
      return (
        heading +
        `研发组织管理自评分：${draft.scores.organization}/20分\n\n一、研发组织与人员\n【待补充：组织架构、研发人员职责】\n\n二、研发管理与投入核算\n【待补充：研发制度、投入核算方式及制度文件】\n\n三、成果转化与人才激励\n【待补充：实际执行措施及证明材料】`
      );
    case 'growth':
      return (
        heading +
        `销售额增长率自评分：${draft.scores.salesGrowth}/10分\n净资产增长率自评分：${draft.scores.netAssetGrowth}/10分\n\n一、销售额及增长情况\n【待补充：对应年度销售额、单位、增长率及计算过程】\n\n二、净资产及增长情况\n【待补充：对应年度净资产、单位、增长率及计算过程】\n\n三、财务证明资料\n【待补充：数据来源及财务报表、审计报告索引】`
      );
  }
}
