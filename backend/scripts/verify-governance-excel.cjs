/** Deterministic Excel regression checks; uses isolated in-memory repositories, never production data. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const { Workbook } = require('exceljs');
const { ClientGovernanceExcelService } = require('../dist/modules/client-governance/governance-excel.service');
const { ENTERPRISE_PROJECTS } = require('../dist/common/constants/enterprise-projects');
const { harness, overall, retired, enterprise, rejected } = require('./helpers/client-governance-harness.cjs');
const headers = ['企业名称', '区域', '销售负责人', '企业项目', '预申报年份'];
const project = ENTERPRISE_PROJECTS[0];
async function upload(rows, options = {}) {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(options.name || '企业档案');
  rows.forEach((row) => sheet.addRow(row));
  return { originalname: '企业档案.xlsx', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
}
async function load(buffer) { const workbook = new Workbook(); await workbook.xlsx.load(buffer); return workbook; }
async function main() {
  const h = harness(); const excel = new ClientGovernanceExcelService(h.service, h.repos.Enterprise);
  const input = { name: '已有企业', regionId: '10', salesOwner: '销售甲', enterpriseProjects: [project], preDeclarationYear: 2027 };
  await h.service.createEnterprise(overall, input);
  h.state().Enterprise.push({ id: '99', name: '已删除企业', status: 0, preDeclarationYear: null });
  for (const actor of [retired, enterprise]) {
    await rejected(() => excel.export(actor), 403);
    await rejected(() => excel.preview(actor), 403);
  }
  await rejected(() => excel.preview(overall), 400);
  await rejected(() => excel.preview(overall, { originalname: 'fake.xlsx', buffer: Buffer.from('abc') }), 400);
  await rejected(() => excel.preview(overall, { originalname: 'legacy.xls', buffer: Buffer.from('abc') }), 400);
  const workbook = new Workbook(); workbook.addWorksheet('说明').addRow(['五字段必填，企业数据在第二个工作表']);
  const sheet = workbook.addWorksheet('企业数据');
  sheet.addRow(['企业申报计划']); sheet.addRow([]);
  sheet.addRow(['预申报年度', '公司名称', '所属区域', '申报项目', '销售负责人']);
  sheet.addRow(['2027年', '新建企业', ' 区域A ', ENTERPRISE_PROJECTS.slice(0, 2).join('、'), ' 销售乙 ']);
  sheet.addRow([2028, '新建企业', '区域A', project, '销售乙']);
  sheet.addRow([2028, '已有企业', '区域A', project, '销售乙']);
  sheet.addRow([2028, '已删除企业', '区域A', project, '销售乙']);
  sheet.addRow([2028, '', '区域A', project, '销售乙']);
  sheet.addRow([2028, '缺区域企业', '', project, '销售乙']);
  sheet.addRow([2028, '缺销售企业', '区域A', project, '']);
  sheet.addRow([2028, '缺项目企业', '区域A', '', '销售乙']);
  sheet.addRow(['', '缺年份企业', '区域A', project, '销售乙']);
  sheet.addRow([2028, '未知区域企业', '未知区域', project, '销售乙']);
  sheet.addRow([2028, '未知项目企业', '区域A', '未知项目', '销售乙']);
  sheet.addRow([2101, '年份错误企业', '区域A', project, '销售乙']);
  sheet.addRow([{ formula: '2027', result: 2027 }, '公式企业', '区域A', project, '销售乙']);
  const file = { originalname: '非标准.xlsx', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
  const before = h.state().Enterprise.length;
  const preview = await excel.preview(overall, file);
  assert.equal(preview.sheetName, '企业数据'); assert.equal(preview.headerRow, 3);
  assert.equal(preview.ready, 1); assert.equal(preview.duplicate, 3); assert.equal(preview.failed, 9);
  assert.equal(preview.rows[0].rowNumber, 4); assert.equal(preview.rows[0].year, 2027);
  assert.equal(preview.rows[0].regionId, '10'); assert.equal(preview.rows[0].salesOwner, '销售乙');
  assert.deepEqual(preview.rows[0].projects, ENTERPRISE_PROJECTS.slice(0, 2));
  assert.deepEqual(preview.missingFields, []);
  assert.equal(h.state().Enterprise.length, before, 'Preview never writes records');
  await rejected(() => excel.confirm({ ...overall, id: 44 }, preview.token), 400);
  await rejected(() => excel.issues({ ...overall, id: 44 }, preview.token), 400);
  const result = await excel.confirm(overall, preview.token);
  assert.equal(result.success, 1); assert.equal(result.duplicate, 3); assert.equal(result.failed, 9);
  assert.equal(h.state().Enterprise.length, before + 1);
  assert.equal(h.state().EnterpriseTeacher.length, 0, 'Import does not assign recipients');
  assert.equal(h.state().Enterprise.at(-1).preDeclarationYear, 2027);
  assert.deepEqual(await excel.confirm(overall, preview.token), result, 'Confirmation replay is idempotent');
  const issues = (await load(await excel.issues(overall, preview.token))).worksheets[0];
  assert.equal(issues.rowCount, 13); assert.equal(issues.getCell('A2').value, 5);
  assert.equal(issues.getCell('H2').value.includes('同名'), true);
  for (let i = 0; i < 15; i++) await h.service.createEnterprise(overall, { ...input, name: `导出测试${i}`, regionId: '11' });
  const all = (await load(await excel.export(overall))).worksheets[0];
  assert.equal(all.rowCount, 18, 'Export includes all records, not only a 10-row page');
  assert.deepEqual(all.getRow(1).values.slice(1), headers);
  const scoped = (await load(await excel.export(overall, { regionId: '11', keyword: '导出测试1', distribution: 'pending' }))).worksheets[0];
  assert.equal(scoped.rowCount, 7, 'Export applies region, keyword and distribution filters');
  const exportedNew = all.getRow(3);
  assert.equal(exportedNew.getCell(4).value, ENTERPRISE_PROJECTS.slice(0, 2).join('；'));
  assert.equal(exportedNew.getCell(5).value, 2027);
  const template = (await load(await excel.export(overall, {}, true))).worksheets[0];
  assert.deepEqual(template.getRow(1).values.slice(1), headers);
  assert.equal(template.getCell('E2').dataValidation.allowBlank ?? false, false);
  assert.equal(template.getCell('E2').value, null, 'Template must not silently fill a year');
  const unknownHeaders = await upload([['名称', '地方', '联系人', '计划', '年份'], ['手动映射企业', '区域A', '销售甲', project, 2028]]);
  const unmapped = await excel.preview(overall, unknownHeaders);
  assert.equal(unmapped.missingFields.length, 5); await rejected(() => excel.confirm(overall, unmapped.token), 400);
  const mapping = { name: 1, region: 2, salesOwner: 3, enterpriseProjects: 4, preDeclarationYear: 5 };
  const mapped = await excel.preview(overall, unknownHeaders, { headerRow: '1', mapping: JSON.stringify(mapping) });
  assert.equal(mapped.ready, 1);
  await rejected(() => excel.preview(overall, unknownHeaders, { mapping: JSON.stringify({ ...mapping, region: 1 }) }), 400);
  await rejected(() => excel.preview(overall, unknownHeaders, { sheetName: 'missing' }), 400);
  await rejected(() => excel.preview(overall, unknownHeaders, { headerRow: '31' }), 400);
  const disabled = await excel.preview(overall, await upload([headers, ['区域停用企业', '区域A', '销售甲', project, 2027]]));
  h.state().Region[0].status = 0;
  assert.equal((await excel.confirm(overall, disabled.token)).success, 0, 'Confirm revalidates enabled regions');
  h.state().Region[0].status = 1;
  const changed = await excel.preview(overall, await upload([headers, ['并发同名企业', '区域A', '销售甲', project, 2027]]));
  await h.service.createEnterprise(overall, { ...input, name: '并发同名企业' });
  assert.equal((await excel.confirm(overall, changed.token)).duplicate, 1, 'Confirm rechecks existing archives');
  const expired = await excel.preview(overall, await upload([headers, ['过期企业', '区域A', '销售甲', project, 2027]]));
  excel.sessions.get(expired.token).expires = Date.now() - 1;
  await rejected(() => excel.confirm(overall, expired.token), 400);
  const large = await upload([headers, ...Array.from({ length: 1001 }, (_, i) => [`超量企业${i}`, '区域A', '销售甲', project, 2027])]);
  await rejected(() => excel.preview(overall, large), 400);
  const oversized = Buffer.from(file.buffer);
  for (let i = 0; i < oversized.length - 46; i++) {
    if (oversized.readUInt32LE(i) === 0x02014b50) { oversized.writeUInt32LE(31 * 1024 * 1024, i + 24); break; }
  }
  await rejected(() => excel.preview(overall, { originalname: 'oversized.xlsx', buffer: oversized }), 400);
  console.log('Governance Excel passed: all five required fields, aliases/reordered columns/title rows/multiple sheets/manual mapping, preview-only, formula rejection, permission/token isolation/expiry, duplicate skip/idempotency, confirm revalidation, full filtered export, project/year round-trip, template/issues and size limits.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
