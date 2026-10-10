import {
  BASIC_INFO_FIELDS, basicInfoErrors, emptyBasicInfo, emptyHighTechDraft,
  HighTechDraft, IP_SUMMARY_FIELDS, PROJECT_FIELDS, SCORE_FIELDS,
} from './high-tech.model';
import {
  activeRows, documentTargets, emptyWorkspace, FEE_FIELDS, FRAMEWORK_FIELDS,
  isActiveReference, MONTH_FIELDS, PS_FIELDS, RD_FIELDS, STAFF_FIELDS,
  STANDARD_FIELDS, syncWorkspace, targetContent,
} from './material-workspace';
import {
  ACHIEVEMENT_EVIDENCE_UPLOAD_TYPES, BOOK_FORM_SECTIONS,
  HITECH_PRODUCT_EVIDENCE_TYPES, SYSTEM_BASE_FIELDS,
} from './material-workspace-catalog';

export interface ProgressAttachment { category: string; reference?: string }
export interface HighTechProgress {
  percent: number;
  stages: { key: string; title: string; weight: number; percent: number; completed: number; total: number }[];
}

// Only editable content counts; identifiers and generated scaffolding are not work.
const CORE_DEFAULTS = new Set(['rdNumber', 'year', 'researchPeriod', 'acquisitionMethod', 'achievementNumber']);
const AUTO_FIELDS = new Set(['company_name', 'ip_class1_count', 'ip_class2_count', 'ip_invention', 'ip_utility', 'ip_design', 'ip_copyright', 'rd_total_3y']);
const filled = (value: unknown) => typeof value === 'string' ? value.trim().length > 0
  : typeof value === 'number' ? Number.isFinite(value) : typeof value === 'boolean';
const numeric = (value: unknown) => filled(value) && Number.isFinite(Number(value));
// Incomplete work must never round up to 100%; retain tenths for small edits.
const percent = (ratio: number) => ratio >= 1 ? 100 : Math.min(99.9, Math.round(ratio * 1000) / 10);

export function calculateHighTechProgress(
  saved?: Partial<HighTechDraft> | null,
  attachments: ProgressAttachment[] = [],
): HighTechProgress {
  // Work on a copy: synchronizing material references must not mutate saved data.
  const draft: HighTechDraft = { ...emptyHighTechDraft(), ...JSON.parse(JSON.stringify(saved ?? {})) };
  draft.basicInfo = { ...emptyBasicInfo(), ...draft.basicInfo };
  const errors = basicInfoErrors(draft.basicInfo);
  const basic = [
    ...BASIC_INFO_FIELDS.map(({ key }) => filled(draft.basicInfo[key]) && !errors[key]),
    typeof draft.basicInfo.hasRdExpenses === 'boolean',
    ...SCORE_FIELDS.map(({ key, max }) => {
      const value = draft.scores?.[key];
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
    }),
  ];
  const ipFields = IP_SUMMARY_FIELDS.filter(({ key }) => key !== 'number');
  const projectFields = PROJECT_FIELDS.filter(({ key }) => !CORE_DEFAULTS.has(key));
  const core = [
    ...(draft.ipSummary.length ? draft.ipSummary : [{}]).flatMap((row) =>
      ipFields.map(({ key }) => filled((row as Record<string, unknown>)[key]))),
    ...(draft.projects.length ? draft.projects : [{}]).flatMap((row) =>
      [...projectFields.map(({ key }) => filled((row as Record<string, unknown>)[key])), filled((row as { psName?: string }).psName)]),
  ];
  const w = draft.workspace ?? emptyWorkspace();
  syncWorkspace(w, draft, '');
  const materials: boolean[] = [];
  // Text areas are counted once below, with the document tasks.
  for (const section of BOOK_FORM_SECTIONS) for (const field of section.fields) {
    if (AUTO_FIELDS.has(field.key) || field.type === 'textarea') continue;
    materials.push(field.type === 'number' ? numeric(w.fields[field.key]) : filled(w.fields[field.key]));
  }
  const bookFields = new Set(BOOK_FORM_SECTIONS.flatMap((section) => section.fields.map((field) => field.key)));
  for (const [key] of SYSTEM_BASE_FIELDS) {
    if (!AUTO_FIELDS.has(key) && !bookFields.has(key)) materials.push(filled(w.fields[key]));
  }
  for (const [key] of FRAMEWORK_FIELDS) for (const suffix of ['files', 'points']) materials.push(filled(w.fields[`system_${key}_${suffix}`]));
  const tables: [string, string[], boolean][] = [
    ['rd', RD_FIELDS.map(([key]) => key).filter((key) => ['source', 'budget'].includes(key)), false],
    ['ps', PS_FIELDS.map(([key]) => key).filter((key) => ['source', 'revenue', 'is_main'].includes(key)), false],
    ['fees', FEE_FIELDS.map(([key]) => key).filter((key) => !['internal', 'total'].includes(key)), false],
    ['staff', STAFF_FIELDS.map(([key]) => key).filter((key) => key !== 'seq'), false],
    ['months', MONTH_FIELDS.map(([key]) => key).filter((key) => key !== 'month'), false],
    // Standards are optional; no record means no applicable task.
    ['standards', STANDARD_FIELDS.map(([key]) => key), true],
  ];
  for (const [table, keys, optional] of tables) {
    const rows = activeRows(w, table);
    for (const row of rows.length || optional ? rows : [{}]) {
      for (const key of keys) materials.push(filled(row[key]));
    }
  }
  for (const target of documentTargets(w)) materials.push(filled(targetContent(w, target)));
  const files = attachments.filter((file) => isActiveReference(w, draft, file.reference));
  const upload = (category: string, reference?: string, alternatives: string[] = []) => {
    materials.push(files.some((file) => file.category === category &&
      (reference === undefined || file.reference === reference || alternatives.includes(file.reference ?? ''))));
  };
  for (const category of ['cover', 'application_pdf', 'business_license', 'hitech_income_audit', 'commitment']) upload(category);
  for (const category of ['rd_expense_audit', 'annual_audit', 'tax_settlement']) {
    const kind = category === 'rd_expense_audit' ? 'rd' : category === 'annual_audit' ? 'annual' : 'tax';
    for (const offset of [3, 2, 1]) {
      const year = w.applicationYear - offset;
      upload(category, `year/${year}`, [`audit/${kind}/${year}`]);
    }
  }
  for (const key of ['social_december', 'social_latest', 'education', 'contracts']) upload('staff_statement', `staff/${key}`);
  for (const row of draft.ipSummary) upload('ip', `ip/${row.id}`);
  if (!draft.ipSummary.length) upload('ip');
  for (const [table, category, types, prefix] of [
    ['ps', 'hitech_products', HITECH_PRODUCT_EVIDENCE_TYPES, 'ps'],
    ['achievements', 'achievement_transform', ACHIEVEMENT_EVIDENCE_UPLOAD_TYPES, 'achievement'],
  ] as const) for (const row of activeRows(w, table)) for (const type of types) {
    // Patent evidence can reuse the certificate already linked to the core IP.
    const linkedIp = type.key === 'patent_cert' && draft.ipSummary.some((ip) =>
      (row.ip || '').split(/[、,，;；\s]+/u).includes(ip.number) &&
      files.some((file) => file.category === 'ip' && file.reference === `ip/${ip.id}`));
    if (linkedIp) materials.push(true);
    else upload(category, `${prefix}/${row.id}/${type.key}`);
  }
  const stage = (key: string, title: string, weight: number, items: boolean[]) => {
    const completed = items.filter(Boolean).length;
    return { key, title, weight, completed, total: items.length, percent: percent(completed / items.length) };
  };
  const stages = [stage('basic', '基础信息填写', 20, basic), stage('core', '制作高新核心信息', 30, core), stage('materials', '制作高新材料', 50, materials)];
  return { percent: percent(stages.reduce((sum, item) => sum + item.completed / item.total * item.weight / 100, 0)), stages };
}
