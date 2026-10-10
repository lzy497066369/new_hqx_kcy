const assert = require('node:assert/strict');
const { calculateHighTechProgress: progress } = require('../dist/modules/client/high-tech/high-tech-progress');
const { emptyHighTechDraft, BASIC_INFO_FIELDS, SCORE_FIELDS, PROJECT_FIELDS, IP_SUMMARY_FIELDS } = require('../dist/modules/client/high-tech/high-tech.model');
const { emptyWorkspace, syncWorkspace, documentTargets, setTargetContent, activeRows, RD_FIELDS, PS_FIELDS, FEE_FIELDS, STAFF_FIELDS, MONTH_FIELDS, STANDARD_FIELDS, FRAMEWORK_FIELDS } = require('../dist/modules/client/high-tech/material-workspace');
const { BOOK_FORM_SECTIONS, HITECH_PRODUCT_EVIDENCE_TYPES, ACHIEVEMENT_EVIDENCE_UPLOAD_TYPES, SYSTEM_BASE_FIELDS } = require('../dist/modules/client/high-tech/material-workspace-catalog');
const { EnterpriseArchiveService } = require('../dist/modules/client/enterprise-archive.service');

async function main() {
  const blank = emptyHighTechDraft();
  assert.equal(progress().percent, 0);
  assert.equal(progress(blank).percent, 0);
  blank.workspace = emptyWorkspace(2026);
  syncWorkspace(blank.workspace, blank, '默认企业');
  assert.equal(progress(blank).percent, 0, 'generated identities and empty templates do not earn credit');
  blank.basicInfo.patentCount = 0;
  blank.basicInfo.hasRdExpenses = false;
  blank.scores.intellectualProperty = 0;
  assert.equal(progress(blank).stages[0].completed, 3, 'zero and false count');
  assert.equal(progress(blank).stages[0].percent, 23.1);
  blank.basicInfo.employeeCount = -1;
  assert.equal(progress(blank).stages[0].completed, 3, 'invalid values do not count');
  const partial = emptyHighTechDraft();
  partial.projects[0].activityName = '已保存的研发活动';
  assert.ok(progress(partial).percent > 0);
  const before = JSON.stringify(partial);
  const partialProgress = progress(partial);
  assert.equal(JSON.stringify(partial), before, 'read must not mutate saved data');
  partial.projects[0].activityName = '';
  assert.ok(progress(partial).percent < partialProgress.percent);
  const upload = [{ category: 'business_license' }];
  assert.ok(progress(blank, upload).stages[2].completed > progress(blank).stages[2].completed);
  const stale = [{ category: 'annual_audit', reference: 'year/2000' }];
  assert.equal(progress(blank, stale).percent, progress(blank).percent);
  const beforeSystem = progress(blank).stages[2].completed;
  blank.workspace.fields.rd_director = '研发负责人';
  assert.equal(progress(blank).stages[2].completed, beforeSystem + 1, 'system information edits earn credit');
  delete blank.workspace.fields.rd_director;

  const full = emptyHighTechDraft();
  for (const { key } of BASIC_INFO_FIELDS) full.basicInfo[key] = 1;
  full.basicInfo.hasRdExpenses = false;
  for (const { key } of SCORE_FIELDS) full.scores[key] = 0;
  full.ipSummary = [{ id: 'ip-one', ...Object.fromEntries(IP_SUMMARY_FIELDS.map(({ key }) => [key, '完整'])) }];
  full.ipSummary[0].number = 'IP01';
  full.projects = [{ ...full.projects[0], ...Object.fromEntries(PROJECT_FIELDS.map(({ key }) => [key, '完整'])), year: 2025, rdNumber: 'RD01', ipNumber: 'IP01', psNumber: 'PS01', psName: '产品名称' }];
  full.workspace = emptyWorkspace(2026);
  const w = full.workspace;
  syncWorkspace(w, full, '完整企业');
  for (const section of BOOK_FORM_SECTIONS) for (const field of section.fields) w.fields[field.key] = field.type === 'number' ? '1' : '完整内容';
  for (const [key] of SYSTEM_BASE_FIELDS) if (w.fields[key] === undefined) w.fields[key] = '完整内容';
  for (const [key] of FRAMEWORK_FIELDS) for (const suffix of ['files', 'points']) w.fields[`system_${key}_${suffix}`] = '完整内容';
  w.tables.staff = [{ id: 'employee-one' }];
  w.tables.standards = [{ id: 'standard-one', no: 'STD01' }];
  for (const [table, fields] of [['rd', RD_FIELDS], ['ps', PS_FIELDS], ['fees', FEE_FIELDS], ['staff', STAFF_FIELDS], ['months', MONTH_FIELDS], ['standards', STANDARD_FIELDS]]) {
    for (const row of activeRows(w, table)) for (const [key] of fields) if (!['no', 'ip', 'rds', 'year'].includes(key)) row[key] = '1';
  }
  syncWorkspace(w, full, '完整企业');
  for (const target of documentTargets(w)) setTargetContent(w, target, '已填写的文档内容');
  const files = ['cover', 'application_pdf', 'business_license', 'hitech_income_audit', 'commitment'].map((category) => ({ category }));
  for (const category of ['rd_expense_audit', 'annual_audit', 'tax_settlement']) for (const year of [2023, 2024, 2025]) files.push({ category, reference: `year/${year}` });
  for (const key of ['social_december', 'social_latest', 'education', 'contracts']) files.push({ category: 'staff_statement', reference: `staff/${key}` });
  files.push({ category: 'ip', reference: 'ip/ip-one' });
  for (const [table, category, types, prefix] of [['ps', 'hitech_products', HITECH_PRODUCT_EVIDENCE_TYPES, 'ps'], ['achievements', 'achievement_transform', ACHIEVEMENT_EVIDENCE_UPLOAD_TYPES, 'achievement']]) {
    for (const row of activeRows(w, table)) for (const type of types) files.push({ category, reference: `${prefix}/${row.id}/${type.key}` });
  }
  const complete = progress(full, files);
  assert.equal(complete.percent, 100, JSON.stringify(complete));
  assert.deepEqual(complete.stages.map((stage) => stage.percent), [100, 100, 100]);
  const withoutFile = progress(full, files.filter((file) => file.category !== 'business_license'));
  assert.ok(withoutFile.percent < 100, 'partial work cannot round to 100');
  const weighted = withoutFile.stages.reduce((sum, stage) => sum + stage.completed / stage.total * stage.weight, 0);
  assert.equal(withoutFile.percent, Math.min(99.9, Math.round(weighted * 10) / 10));
  w.tables.staff.push({ id: 'archived', archived: '1' });
  assert.equal(progress(full, files).percent, 100, 'archived rows are excluded');

  const queried = [];
  const repo = (name, data) => ({ find: async (query) => { queried.push({ name, query }); return data; } });
  const fileReads = [];
  const service = new EnterpriseArchiveService(
    repo('teachers', [{ enterpriseId: '101', teacher: { status: 1, realName: '项目负责人', username: 'teacher' } }]),
    repo('owners', [{ enterpriseId: '101', user: { status: 1, realName: '历史负责人' } }]),
    repo('applications', [{ enterpriseId: '101', draftJson: JSON.stringify(full) }]),
    { list: async (id) => { fileReads.push(id); return files; } },
  );
  assert.deepEqual(await service.enrich([]), []);
  assert.equal(queried.length, 0);
  const result = await service.enrich([{ id: '101', enterpriseProjects: ['国家高新技术企业'] }, { id: '102', enterpriseProjects: ['专精特新企业'] }]);
  assert.equal(result[0].projectLeader, '项目负责人');
  assert.equal(result[0].highTechProgress.percent, 100);
  assert.equal(result[1].highTechProgress, null);
  assert.deepEqual(fileReads, ['101']);
  assert.equal(queried.length, 3, 'batch queries rather than per-company reads');
  assert.deepEqual(queried[2].query.where.enterpriseId.value, ['101']);
  for (const query of queried.slice(0, 2)) assert.deepEqual(query.query.where.enterpriseId.value, ['101', '102']);
  console.log('PASS: empty/partial/full progress, defaults, zero/false, attachments, archived rows, clearing, weights and scoped batch enrichment');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
