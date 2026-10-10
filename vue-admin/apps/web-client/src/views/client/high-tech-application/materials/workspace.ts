import {
  BOOK_FORM_SECTIONS,
  HR_OVERVIEW_ROWS,
  SYSTEM_DOC_TYPES,
  SYSTEM_EVIDENCE_FILE_TEMPLATES,
} from './catalog';

export interface WorkspaceDocument {
  content: string;
  reviewed: boolean;
  source?: string;
}
export interface MaterialWorkspace {
  version: 1;
  applicationYear: number;
  fields: Record<string, string>;
  tables: Record<string, Record<string, string>[]>;
  documents: Record<string, WorkspaceDocument>;
}
export interface WorkspaceSource {
  basicInfo: {
    employeeCount: number | null;
    insuredEmployeeCount: number | null;
    salesRevenue: number | null;
  };
  ipSummary: {
    id: string;
    number: string;
    name: string;
    patentType: string;
    patentNumber: string;
    patentee: string;
    grantDate: string;
    applicationDate: string;
    legalStatus: string;
  }[];
  projects: {
    id: string;
    year: number | null;
    rdNumber: string;
    activityName: string;
    researchPeriod: string;
    techField: string;
    ipNumber: string;
    psNumber: string;
    psName?: string;
    achievementNumber: string;
    achievementName: string;
  }[];
  book: { key: string; content: string; reviewed: boolean }[];
  attachments: { key: string; content: string; reviewed: boolean }[];
}
export const RD_FIELDS = [
  ['no', '研发活动编号'],
  ['name', '研发活动名称'],
  ['period', '起止时间'],
  ['field', '技术领域'],
  ['source', '技术来源'],
  ['ip', '对应知识产权'],
  ['ps', '关联PS'],
  ['budget', '研发经费预算（万元）'],
  ['total', '近三年总支出（万元）'],
  ['y1', '第一年支出（万元）'],
  ['y2', '第二年支出（万元）'],
  ['y3', '第三年支出（万元）'],
  ['purpose', '立项目的及组织实施方式'],
  ['innovation', '核心技术及创新点'],
  ['result', '取得的阶段性成果'],
];
export const PS_FIELDS = [
  ['no', '产品编号'],
  ['name', '产品（服务）名称'],
  ['field', '技术领域'],
  ['source', '技术来源'],
  ['revenue', '上年度销售收入（万元）'],
  ['is_main', '是否主要产品（服务）'],
  ['rds', '关联RD项目'],
  ['ip', '对应知识产权'],
  ['tech', '关键技术及主要技术指标'],
  ['advantage', '与同类产品的竞争优势'],
  ['ip_support', '知识产权对产品的支持作用'],
];
export const FEE_FIELDS = [
  ['labor', '人员人工费用'],
  ['direct', '直接投入费用'],
  ['depreciation', '折旧费用与长期待摊费用'],
  ['amortization', '无形资产摊销费用'],
  ['design', '设计费用'],
  ['testing', '装备调试费用与试验费用'],
  ['other', '其他费用'],
  ['internal', '内部研发费用小计'],
  ['outsource', '委托外部研发费用'],
  ['outsource_cn', '其中：境内外部研发费用'],
  ['total', '研发费用（内、外部）小计'],
];
export const STAFF_FIELDS = [
  ['seq', '序号'],
  ['name', '姓名'],
  ['id_no', '身份证号'],
  ['contract', '是否签订合同'],
  ['social_security', '是否缴纳社保'],
  ['education', '学历'],
  ['title', '职称'],
  ['is_tech', '是否科技人员'],
];
export const STANDARD_FIELDS = [
  ['name', '标准名称'],
  ['level', '标准级别'],
  ['no', '标准编号'],
  ['role', '企业参与角色'],
];
export const MONTH_FIELDS = [
  ['month', '月份'],
  ['start_total', '月初职工总数'],
  ['start_tech', '月初科技人员数'],
  ['end_total', '月末职工总数'],
  ['end_tech', '月末科技人员数'],
];
export const FRAMEWORK_FIELDS = [
  ['rd', '研发组织管理与投入核算'],
  ['org', '研发机构与产学研合作'],
  ['transform', '成果转化与创新平台'],
  ['talent', '人员培养与绩效奖励'],
];
export function emptyWorkspace(
  year = Number(
    new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
    }).format(new Date()),
  ),
): MaterialWorkspace {
  return {
    version: 1,
    applicationYear: year,
    fields: {},
    tables: {},
    documents: {},
  };
}
const safeKey = /^[a-zA-Z0-9_:/.-]{1,180}$/;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('材料数据格式不正确');
  return value as Record<string, unknown>;
}
function stringMap(value: unknown, limit: number): Record<string, string> {
  const entries = Object.entries(record(value));
  if (entries.length > limit) throw new Error('材料字段过多');
  return Object.fromEntries(
    entries.map(([key, item]) => {
      if (
        !safeKey.test(key) ||
        ['__proto__', 'constructor', 'prototype'].includes(key) ||
        typeof item !== 'string' ||
        item.length > 50000
      )
        throw new Error('材料字段不正确或过长');
      return [key, item];
    }),
  );
}
export function normalizeWorkspace(value: unknown): MaterialWorkspace {
  if (value === undefined) return emptyWorkspace();
  if (JSON.stringify(value).length > 6_000_000)
    throw new Error('材料草稿超过6MB，请分批整理');
  const source = record(value);
  if (
    source.version !== 1 ||
    !Number.isInteger(source.applicationYear) ||
    Number(source.applicationYear) < 2000 ||
    Number(source.applicationYear) > 2100
  )
    throw new Error('申报年度不正确');
  const result = emptyWorkspace(Number(source.applicationYear));
  result.fields = stringMap(source.fields, 1000);
  const tables = Object.entries(record(source.tables));
  if (tables.length > 25) throw new Error('材料表格过多');
  for (const [key, rows] of tables) {
    if (
      ![
        'rd',
        'ps',
        'achievements',
        'staff',
        'months',
        'standards',
        'fees',
      ].includes(key) ||
      !Array.isArray(rows) ||
      rows.length > 2000
    )
      throw new Error('材料表格不正确');
    result.tables[key] = rows.map((row) => stringMap(row, 60));
    const ids = result.tables[key].map((row) => row.id);
    if (
      ids.some((id) => !id || !safeKey.test(id)) ||
      new Set(ids).size !== ids.length
    )
      throw new Error('材料行标识重复或无效');
  }
  const documents = Object.entries(record(source.documents));
  if (documents.length > 1500) throw new Error('材料文档过多');
  for (const [key, item] of documents) {
    const doc = record(item);
    if (
      !safeKey.test(key) ||
      ['__proto__', 'constructor', 'prototype'].includes(key) ||
      typeof doc.content !== 'string' ||
      doc.content.length > 50000 ||
      typeof doc.reviewed !== 'boolean' ||
      (doc.source !== undefined &&
        (typeof doc.source !== 'string' || doc.source.length > 20000))
    )
      throw new Error('材料正文格式不正确');
    if (
      doc.reviewed &&
      (!doc.content.trim() || /【待补充[^】]*】/.test(doc.content))
    )
      throw new Error('请补齐材料正文后再标记已核对');
    result.documents[key] = {
      content: doc.content,
      reviewed: doc.reviewed,
      ...(doc.source !== undefined ? { source: doc.source as string } : {}),
    };
  }
  recalculateStaff(result);
  validateWorkspace(result);
  return result;
}
const unique = (values: string[]) =>
  [...new Set(values.filter(Boolean))].join('、');
function rowsFor(
  workspace: MaterialWorkspace,
  table: string,
  source: Record<string, string>[],
) {
  const previous = workspace.tables[table] ?? [];
  // Keep removed records for recovery, but don't present or export them as current materials.
  workspace.tables[table] = [
    ...source.map((row) => {
      const old = previous.find((item) => item.id === row.id);
      return {
        ...old,
        ...row,
        ...(table === 'ps'
          ? {
              name: row.name || old?.name || '',
              field: row.field || old?.field || '',
            }
          : {}),
        archived: '',
      };
    }),
    ...previous
      .filter((row) => !source.some((item) => item.id === row.id))
      .map((row) => ({ ...row, archived: '1' })),
  ];
}
export function activeRows(workspace: MaterialWorkspace, table: string) {
  return (workspace.tables[table] ?? []).filter((row) => !row.archived);
}
export function syncWorkspace(
  workspace: MaterialWorkspace,
  draft: WorkspaceSource,
  companyName: string,
) {
  const seed = (key: string, value: unknown) => {
    if (workspace.fields[key] === undefined && value != null)
      workspace.fields[key] = String(value);
  };
  workspace.fields.company_name = companyName;
  seed('staff_total', draft.basicInfo.employeeCount);
  seed('hr_total', draft.basicInfo.employeeCount);
  seed('year3_sales', draft.basicInfo.salesRevenue);
  seed(
    'company_intro',
    draft.book.find((s) => s.key === 'profile')?.content || '',
  );
  for (const [field, legacy] of [
    ['innovation_ip', 'innovation_ip'],
    ['innovation_transform', 'innovation_transform'],
    ['innovation_rd_mgmt', 'innovation_organization'],
    ['innovation_staff', 'innovation_staff'],
  ])
    seed(field!, draft.book.find((s) => s.key === legacy)?.content || '');
  for (const [field, type] of [
    ['ip_invention', '发明专利'],
    ['ip_utility', '实用新型'],
    ['ip_design', '外观设计'],
    ['ip_copyright', '软件著作权'],
  ])
    workspace.fields[field!] = String(
      draft.ipSummary.filter((row) => row.patentType === type).length,
    );
  workspace.fields.ip_class1_count = String(
    draft.ipSummary.filter((r) => r.patentType === '发明专利').length,
  );
  workspace.fields.ip_class2_count = String(
    draft.ipSummary.filter((r) => r.patentType !== '发明专利').length,
  );
  const groups = new Map<string, WorkspaceSource['projects']>();
  for (const row of draft.projects) {
    if (!row.rdNumber.trim()) continue;
    const key = `${row.year}:${row.rdNumber}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  rowsFor(
    workspace,
    'rd',
    [...groups.values()].map((rows) => {
      const first = rows[0]!;
      const old = (workspace.tables.rd ?? []).find(
        (r) => r.no === first.rdNumber && r.year === String(first.year ?? ''),
      );
      return {
        id:
          old?.id ||
          `rd-${first.year}-${encodeURIComponent(first.rdNumber).replace(/%/g, '')}`,
        no: first.rdNumber,
        year: String(first.year ?? ''),
        name: first.activityName,
        period: first.researchPeriod,
        field: first.techField,
        ip: unique(rows.map((r) => r.ipNumber)),
        ps: unique(rows.map((r) => r.psNumber)),
      };
    }),
  );
  const products = new Map<string, WorkspaceSource['projects']>();
  for (const row of draft.projects)
    for (const no of row.psNumber.split(/[、,，;；\s]+/).filter(Boolean))
      products.set(no, [...(products.get(no) ?? []), row]);
  rowsFor(
    workspace,
    'ps',
    [...products].map(([no, rows]) => ({
      id: `ps-${encodeURIComponent(no).replace(/%/g, '')}`,
      no,
      name: rows.find((r) => r.psName)?.psName || '',
      field: unique(rows.map((r) => r.techField)),
      rds: unique(rows.map((r) => r.rdNumber)),
      ip: unique(rows.map((r) => r.ipNumber)),
    })),
  );
  rowsFor(
    workspace,
    'achievements',
    draft.projects
      .filter((r) => r.achievementNumber || r.achievementName)
      .map((r) => ({
        id: r.id,
        no: r.achievementNumber,
        name: r.achievementName,
        rd: r.rdNumber,
        ip: r.ipNumber,
        ps: r.psNumber,
        year: String(r.year ?? ''),
      })),
  );
  const months = Array.from({ length: 12 }, (_, i) => ({
    id: `${workspace.applicationYear - 1}-${i + 1}`,
    month: `${workspace.applicationYear - 1}年${i + 1}月`,
  }));
  rowsFor(workspace, 'months', months);
  workspace.tables.staff ??= [];
  workspace.tables.standards ??= [];
  rowsFor(
    workspace,
    'fees',
    [3, 2, 1].flatMap((offset) =>
      activeRows(workspace, 'rd').map((rd) => ({
        id: `${workspace.applicationYear - offset}:${rd.id}`,
        year: String(workspace.applicationYear - offset),
        rdId: rd.id!,
        no: rd.no!,
      })),
    ),
  );
  recalculateWorkspace(workspace);
  for (const target of documentTargets(workspace)) {
    const doc = workspace.documents[target.key];
    if (
      doc &&
      (doc.source !== target.source ||
        doc.content !== targetContent(workspace, target))
    )
      doc.reviewed = false;
  }
}
export interface DocumentTarget {
  key: string;
  title: string;
  category: string;
  guide: string;
  source: string;
  table?: string;
  rowId?: string;
  field?: string;
}
export function documentTargets(w: MaterialWorkspace): DocumentTarget[] {
  const targets: DocumentTarget[] = [];
  const add = (
    key: string,
    title: string,
    category: string,
    guide = '',
    row?: Record<string, string>,
    table?: string,
    field?: string,
  ) => {
    const identity = row
      ? {
          id: row.id,
          no: row.no,
          name: row.name,
          period: row.period,
          year: row.year,
          rd: row.rd,
          rds: row.rds,
          ip: row.ip,
          ps: row.ps,
        }
      : { company: w.fields.company_name, year: w.applicationYear };
    targets.push({
      key,
      title,
      category,
      guide,
      source: JSON.stringify(identity),
      ...(table ? { table, rowId: row?.id } : {}),
      ...(field ? { field } : {}),
    });
  };
  for (const section of BOOK_FORM_SECTIONS)
    for (const f of section.fields.filter((f) => f.type === 'textarea'))
      add(`field/${f.key}`, f.label, 'book', '', undefined, undefined, f.key);
  for (const [table, fields] of [
    ['rd', RD_FIELDS.slice(-3)],
    ['ps', PS_FIELDS.slice(-3)],
  ] as const)
    for (const row of activeRows(w, table))
      for (const [field, title] of fields)
        add(
          `${table}/${row.id}/${field}`,
          `${row.no} ${title}`,
          'book',
          title,
          row,
          table,
          field,
        );
  add('staff/statement', '企业职工人员情况说明', 'staff_statement');
  add('staff/tables', '企业人员名单及人员统计表', 'staff_statement');
  add('ps/summary', '高新技术产品（服务）汇总表', 'hitech_products');
  add('achievement/summary', '科技成果转化汇总表', 'achievement_transform');
  add('system/summary', '研究开发组织管理制度汇总表', 'system_docs');
  for (const row of activeRows(w, 'rd'))
    add(
      `rd/${row.id}/application`,
      `${row.no} ${row.name} 科研项目书`,
      'rd_project_table',
      '包含项目基本信息、立项背景、研发目标、研发内容、技术路线、创新点、实施计划、组织分工、预算及预期成果。',
      row,
      'rd',
    );
  for (const row of activeRows(w, 'ps')) {
    add(
      `ps/${row.id}/statement`,
      `${row.no}情况说明`,
      'hitech_products',
      '说明产品关键技术、指标、应用领域、竞争优势、收入和知识产权支撑。',
      row,
      'ps',
    );
    add(
      `ps/${row.id}/test_report`,
      `${row.no}性能测试报告`,
      'hitech_products',
      '提供待填写的测试方案和记录模板，缺少实测数据不可生成通过结论。',
      row,
      'ps',
    );
  }
  for (const row of activeRows(w, 'achievements'))
    for (const [type, title] of [
      ['description', '转化结果描述'],
      ['test_report', '性能测试报告'],
      ['user_report', '用户使用报告'],
    ])
      add(
        `achievement/${row.id}/${type}`,
        `${row.no} ${row.name} ${title}`,
        'achievement_transform',
        title,
        row,
        'achievements',
      );
  for (const doc of SYSTEM_DOC_TYPES) {
    add(`system/${doc.key}`, doc.title, 'system_docs', doc.guide);
    const evidence =
      SYSTEM_EVIDENCE_FILE_TEMPLATES[
        doc.key as keyof typeof SYSTEM_EVIDENCE_FILE_TEMPLATES
      ] ?? [];
    evidence.forEach(([title, guide], index) =>
      add(`system/${doc.key}/evidence/${index}`, title!, 'system_docs', guide),
    );
    add(
      `system/${doc.key}/notice`,
      `${doc.title}发布通知`,
      'system_docs',
      '制度发布通知草稿。签发人、签发日期必须由企业核实填写。',
    );
  }
  return targets;
}
export function targetContent(
  w: MaterialWorkspace,
  target: DocumentTarget,
): string {
  if (target.field)
    return target.table
      ? (activeRows(w, target.table).find((r) => r.id === target.rowId)?.[
          target.field
        ] ?? '')
      : (w.fields[target.field] ?? '');
  return w.documents[target.key]?.content ?? '';
}
export function setTargetContent(
  w: MaterialWorkspace,
  target: DocumentTarget,
  content: string,
) {
  if (target.field) {
    if (target.table) {
      const row = activeRows(w, target.table).find(
        (r) => r.id === target.rowId,
      );
      if (row) row[target.field] = content;
    } else w.fields[target.field] = content;
  }
  w.documents[target.key] = { content, reviewed: false, source: target.source };
}
export function monthAverage(
  row: Record<string, string>,
  type: 'total' | 'tech',
) {
  const start = row[`start_${type}`],
    end = row[`end_${type}`];
  return start?.trim() &&
    end?.trim() &&
    Number.isFinite(Number(start)) &&
    Number.isFinite(Number(end))
    ? (Number(start) + Number(end)) / 2
    : null;
}
export function feeValue(row: Record<string, string>, key: string): string {
  if (key === 'internal') {
    const values = FEE_FIELDS.slice(0, 7).map(([field]) => row[field!]);
    return values.some((v) => v?.trim())
      ? values.reduce((sum, v) => sum + (Number(v) || 0), 0).toFixed(2)
      : '';
  }
  if (key === 'total')
    return feeValue(row, 'internal') || row.outsource
      ? (
          (Number(feeValue(row, 'internal')) || 0) +
          (Number(row.outsource) || 0)
        ).toFixed(2)
      : '';
  return row[key] ?? '';
}

// Only explicit, recognized values participate in structure counts.
const STAFF_EDUCATION_GROUPS: Record<string, string[]> = {
  edu_phd: ['博士', '博士研究生'],
  edu_master: ['硕士', '硕士研究生'],
  edu_bachelor: ['本科', '大学本科', '大学本科学历'],
  edu_diploma: ['大专及以下', '大专', '专科', '大学专科', '中专', '高中', '职高', '技校', '中职', '初中', '小学', '小学及以下', '无学历'],
};
const STAFF_TITLE_GROUPS: Record<string, string[]> = {
  title_senior: ['高级', '高级职称', '正高级', '副高级', '正高级职称', '副高级职称', '高级工程师', '正高级工程师', '副高级工程师'],
  title_mid: ['中级', '中级职称', '工程师', '中级工程师'],
  title_junior: ['初级', '初级职称', '助理工程师', '技术员'],
  title_tech: ['高级技工'],
};
function staffBirthYear(id: string, referenceYear: number): number | undefined {
  const normalized = id.trim().toUpperCase();
  const birth = /^\d{17}[\dX]$/.test(normalized)
    ? normalized.slice(6, 14)
    : /^\d{15}$/.test(normalized)
      ? `19${normalized.slice(6, 12)}`
      : '';
  if (!birth) return;
  const year = Number(birth.slice(0, 4));
  const month = Number(birth.slice(4, 6));
  const day = Number(birth.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900 || year > referenceYear ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day
  ) return;
  return year;
}
function fillStaffCategoryDefaults(w: MaterialWorkspace) {
  const seed = (key: string, value: string | undefined) => {
    if (!w.fields[key]?.trim() && value?.trim()) w.fields[key] = value;
  };
  seed('hr_fulltime', w.fields.hr_total);
  seed('hr_tech_fulltime', w.fields.hr_tech);
  for (const row of HR_OVERVIEW_ROWS.slice(2)) {
    seed(row.employeeKey, '0');
    seed(row.techKey, '0');
  }
}
export function recalculateStaff(w: MaterialWorkspace, applied = false) {
  const staff = activeRows(w, 'staff').filter((row) => row.name?.trim());
  // Preserve manually entered forms until a roster is available. Persist the
  // marker so deleting the final person also clears counts after saving/reloading.
  if (!applied && !staff.length && w.fields.hr_derived_staff !== '1') {
    fillStaffCategoryDefaults(w);
    return;
  }
  w.fields.hr_derived_staff = '1';
  const counts: Record<string, number> = {
    hr_total: staff.length, hr_tech: 0,
    ...Object.fromEntries(Object.keys(STAFF_EDUCATION_GROUPS).map((key) => [key, 0])),
    ...Object.fromEntries(Object.keys(STAFF_TITLE_GROUPS).map((key) => [key, 0])),
    age_30: 0, age_31_40: 0, age_41_50: 0, age_51: 0,
  };
  const increment = (key: string) => { counts[key] = (counts[key] ?? 0) + 1; };
  const referenceYear = w.applicationYear - 1;
  for (const row of staff) {
    if (['是', '1', 'true', 'yes', 'y'].includes(row.is_tech?.trim().toLowerCase() ?? ''))
      increment('hr_tech');
    for (const [column, groups] of [
      ['education', STAFF_EDUCATION_GROUPS], ['title', STAFF_TITLE_GROUPS],
    ] as const) {
      const value = row[column]?.replace(/\s+/g, '') ?? '';
      const key = Object.keys(groups).find((key) => groups[key]!.includes(value));
      if (key) increment(key);
    }
    const birthYear = staffBirthYear(row.id_no ?? '', referenceYear);
    if (birthYear !== undefined) {
      const age = referenceYear - birthYear;
      increment(age <= 30 ? 'age_30' : age <= 40 ? 'age_31_40' : age <= 50 ? 'age_41_50' : 'age_51');
    }
  }
  for (const [key, value] of Object.entries(counts)) w.fields[key] = String(value);
  fillStaffCategoryDefaults(w);
}

export function recalculateWorkspace(w: MaterialWorkspace) {
  recalculateStaff(w);
  const fees = activeRows(w, 'fees');
  for (const rd of activeRows(w, 'rd')) {
    const totals = [3, 2, 1].map((offset, index) => {
      const fee = fees.find(
        (r) =>
          r.rdId === rd.id && r.year === String(w.applicationYear - offset),
      );
      const value = fee ? feeValue(fee, 'total') : '';
      if (value !== '') {
        rd[`y${index + 1}`] = value;
        rd[`fee_derived_y${index + 1}`] = '1';
      } else if (rd[`fee_derived_y${index + 1}`]) rd[`y${index + 1}`] = '';
      return rd[`y${index + 1}`] || '';
    });
    if (totals.every((v) => v !== '')) {
      rd.total = totals.reduce((sum, v) => sum + Number(v), 0).toFixed(2);
      rd.fee_derived_total = '1';
    } else if (rd.fee_derived_total) rd.total = '';
  }
  const totals = activeRows(w, 'rd').map((r) => r.total);
  if (totals.length && totals.every((v) => v?.trim())) {
    w.fields.rd_total_3y = totals
      .reduce((sum, v) => sum + Number(v), 0)
      .toFixed(2);
    w.fields.fee_derived_total = '1';
  } else if (w.fields.fee_derived_total) w.fields.rd_total_3y = '';
}

export function validateWorkspace(w: MaterialWorkspace) {
  const check = (
    value: string | undefined,
    label: string,
    negative = false,
    integer = false,
  ) => {
    if (!value?.trim()) return;
    const n = Number(value);
    if (
      !Number.isFinite(n) ||
      (!negative && n < 0) ||
      (integer && !Number.isInteger(n))
    )
      throw new Error(
        `${label}须填写${negative ? '' : '非负'}${integer ? '整数' : '数值'}`,
      );
  };
  for (const section of BOOK_FORM_SECTIONS)
    for (const f of section.fields)
      if (f.type === 'number')
        check(
          w.fields[f.key],
          f.label,
          /_(assets|profit)$/.test(f.key),
          /^(hr_|staff_|ip_|edu_|title_|age_)/.test(f.key),
        );
  for (const row of activeRows(w, 'rd'))
    for (const key of ['budget', 'total', 'y1', 'y2', 'y3'])
      check(row[key], `${row.no}研发支出`);
  for (const row of activeRows(w, 'ps')) check(row.revenue, `${row.no}收入`);
  for (const row of activeRows(w, 'fees')) {
    for (const [key, label] of FEE_FIELDS)
      check(row[key!], `${row.year}年${row.no}${label}`);
    if (
      row.outsource_cn?.trim() &&
      row.outsource?.trim() &&
      Number(row.outsource_cn) > Number(row.outsource)
    )
      throw new Error('境内委托研发费用不能超过委托外部研发费用');
  }
  for (const row of activeRows(w, 'months')) {
    for (const [key, label] of MONTH_FIELDS.slice(1))
      check(row[key!], `${row.month}${label}`, false, true);
    for (const prefix of ['start', 'end'])
      if (
        row[`${prefix}_tech`]?.trim() &&
        row[`${prefix}_total`]?.trim() &&
        Number(row[`${prefix}_tech`]) > Number(row[`${prefix}_total`])
      )
        throw new Error(`${row.month}科技人员数不能超过职工总数`);
  }
  if (
    w.fields.hr_tech?.trim() &&
    w.fields.hr_total?.trim() &&
    Number(w.fields.hr_tech) > Number(w.fields.hr_total)
  )
    throw new Error('科技人员数不能超过职工总数');
  for (const row of HR_OVERVIEW_ROWS.slice(1)) {
    const employee = w.fields[row.employeeKey];
    const tech = w.fields[row.techKey];
    if (employee?.trim() && tech?.trim() && Number(tech) > Number(employee))
      throw new Error(`${row.label}中科技人员数不能超过对应企业职工人数`);
    if (
      tech?.trim() &&
      w.fields.hr_tech?.trim() &&
      Number(tech) > Number(w.fields.hr_tech)
    )
      throw new Error(`${row.label}中科技人员数不能超过科技人员总数`);
  }
}
export function materialTemplate(
  w: MaterialWorkspace,
  target: DocumentTarget,
): string {
  const row = target.table
    ? activeRows(w, target.table).find((r) => r.id === target.rowId)
    : undefined;
  const headings: Record<string, string[]> = {
    company_intro: [
      '企业基本情况',
      '主营业务与产品',
      '研发条件与团队',
      '核心技术与知识产权',
      '市场应用及发展规划',
    ],
    business_scope: ['登记经营范围', '主营业务与经营范围对应情况'],
    purpose: ['立项目的', '技术背景与需求', '研发目标', '组织实施方式'],
    innovation: ['核心技术', '主要创新点', '技术指标与验证方法'],
    result: [
      '核心知识产权成果',
      '实体与技术成果',
      '测试与验证成果',
      '成果应用',
    ],
    tech: ['关键技术', '主要技术指标', '应用领域'],
    advantage: ['同类产品对比', '技术优势', '性能及成本优势'],
    ip_support: ['关联知识产权', '核心技术对应关系', '对产品的支持作用'],
    innovation_ip: [
      '知识产权数量和类型',
      '技术先进性',
      '对主要产品的支持作用',
      '获得方式',
    ],
    innovation_transform: [
      '成果来源',
      '转化组织实施',
      '转化形式与成效',
      '相关证明材料',
    ],
    innovation_rd_mgmt: [
      '研发组织与投入核算',
      '研发机构与产学研合作',
      '成果转化与创新平台',
      '人员培养与绩效奖励',
    ],
    innovation_staff: [
      '管理团队情况',
      '科技人员构成',
      '研发人员职责与能力',
      '人才培养与激励措施',
    ],
    application: [
      '项目基本信息',
      '立项背景',
      '研发目标',
      '研发内容',
      '技术路线',
      '创新点',
      '实施计划',
      '组织分工',
      '经费预算',
      '预期成果',
    ],
    description: [
      '成果基本情况',
      '成果来源和核心技术',
      '成果转化过程',
      '转化结果与应用',
      '知识产权及证明材料',
    ],
    statement: ['基本情况', '技术及产品情况', '统计口径与数据依据', '证明材料'],
    test_report: [
      '测试目的',
      '测试对象与环境',
      '测试方法及标准',
      '测试记录（由企业填写实测数据）',
      '结果分析（依据实测记录填写）',
      '测试人员及日期',
    ],
    user_report: [
      '用户基本情况',
      '产品使用情况',
      '使用效果（由用户核实填写）',
      '用户意见',
      '签章及日期',
    ],
  };
  const key = target.field || target.key.split('/').pop() || '';
  return `${w.fields.company_name || '【待补充：企业名称】'}\n${target.title}\n${row ? `关联项目：${row.no || ''} ${row.name || ''}\n` : ''}\n${(headings[key] || [target.title, '适用范围', '职责分工', '实施流程', '记录与佐证']).map((h, i) => `${i + 1}、${h}\n【待补充：${h}的真实资料】`).join('\n\n')}`;
}

export function isActiveReference(
  w: MaterialWorkspace,
  draft: WorkspaceSource,
  reference = '',
) {
  if (!reference) return true;
  const [kind, id, year] = reference.split('/');
  if (kind === 'ip') return draft.ipSummary.some((r) => r.id === id);
  if (['rd', 'ps', 'achievement'].includes(kind!))
    return activeRows(w, kind === 'achievement' ? 'achievements' : kind!).some(
      (r) => r.id === id,
    );
  if (kind === 'year')
    return [
      w.applicationYear - 3,
      w.applicationYear - 2,
      w.applicationYear - 1,
    ].includes(Number(id));
  if (kind === 'audit')
    return [
      w.applicationYear - 3,
      w.applicationYear - 2,
      w.applicationYear - 1,
    ].includes(Number(year));
  return true;
}
