const assert = require('node:assert/strict');
const { Workbook } = require('exceljs');
const { once } = require('node:events');
const { Module } = require('@nestjs/common');
const { GUARDS_METADATA } = require('@nestjs/common/constants');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const { ResponseInterceptor } = require('../dist/common/interceptors/response.interceptor');
const { highTechDraftBodyParser } = require('../dist/modules/client/high-tech/high-tech-body-parser');
const { HighTechService } = require('../dist/modules/client/high-tech/high-tech.service');
const { HighTechController } = require('../dist/modules/client/high-tech/high-tech.controller');
const { emptyHighTechDraft, normalizeHighTechDraft, completedHighTechSelfScore, synchronizeIpNumbers, IP_SUMMARY_FIELDS, PROJECT_FIELDS, SCORE_FIELDS } = require('../dist/modules/client/high-tech/high-tech.model');

function filledDraft() {
  const draft = { ...emptyHighTechDraft(), revision: 0 };
  for (const field of SCORE_FIELDS) draft.scores[field.key] = field.max;
  const row = { id: 'row-1' };
  for (const field of PROJECT_FIELDS) row[field.key] = `${field.label}测试`;
  row.year = 2026;
  row.applicationDate = '2025-01-01';
  row.authorizationDate = '2026-10-01';
  draft.projects = [row];
  return draft;
}
function harness() {
  const entities = new Map();
  let assigned = true;
  const repository = {
    findOne: async ({ where }) => entities.get(where.enterpriseId) ?? null,
    insert: async (value) => {
      if (entities.has(value.enterpriseId)) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
      entities.set(value.enterpriseId, { ...value });
    },
    update: async (where, value) => {
      const entity = entities.get(where.enterpriseId);
      if (!entity || entity.revision !== where.revision) return { affected: 0 };
      entities.set(where.enterpriseId, { ...entity, ...value });
      return { affected: 1 };
    },
  };
  const client = { getClientCompanies: async (user) => user === 1 && assigned ? [
    { id: '101', name: '测试企业A', enterpriseProjects: ['国家高新技术企业'] },
    { id: '102', name: '测试企业B', enterpriseProjects: ['国家高新技术企业'] },
    { id: '103', name: '无高新项目企业', enterpriseProjects: ['专精特新企业'] },
  ] : [] };
  return { service: new HighTechService(repository, client), entities, revoke: () => { assigned = false; } };
}
const rejects = (callback, status) => assert.rejects(callback, (error) => error.getStatus?.() === status);
const ipExample = ['IP01', '智能控制装置', '发明专利', '授权', '00123456.X', '测试企业A', '2023-05-20', '2025-06-08'];
async function ipFile(values, headers = IP_SUMMARY_FIELDS.map(({ label }) => label), name = '专利证书') {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(headers);
  sheet.addRows(values);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { originalname: '知识产权.xlsx', size: buffer.length, buffer };
}
async function verifyIpSummary() {
  const { service, entities } = harness();
  assert.deepEqual(IP_SUMMARY_FIELDS.map(({ label }) => label), ['编号', '名称', '专利类型', '法律状态', '专利号', '专利权人', '申请日期', '授权日期']);
  const file = await ipFile([ipExample, ['IP02', '管理软件', '软件著作权', '有效', '2024SR0123456', '测试企业A', '2023年9月14日', '2024/3/20']]);
  const imported = await service.importIpSummary(1, '101', file);
  assert.equal(imported.total, 2);
  assert.equal(new Set(imported.rows.map(({ id }) => id)).size, 2);
  assert.equal(imported.rows[0].patentNumber, '00123456.X');
  assert.equal(imported.rows[1].legalStatus, '授权');
  assert.equal(imported.rows[1].grantDate, '2024-03-20');
  assert.equal(imported.rows[1].applicationDate, '2023-09-14');
  assert.deepEqual((await service.get(1, '101')).ipSummary, [], 'Import never autosaves');
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('专利证书');
  sheet.addRow(IP_SUMMARY_FIELDS.map(({ label }) => label));
  sheet.addRow([...ipExample.slice(0, 4), 12345, ipExample[5], new Date('2023-05-20T00:00:00Z'), 45816]);
  sheet.getCell('E2').numFmt = '00000000';
  const numericBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const numeric = await service.importIpSummary(1, '101', { ...file, buffer: numericBuffer, size: numericBuffer.length });
  assert.equal(numeric.rows[0].patentNumber, '00012345');
  assert.equal(numeric.rows[0].grantDate, '2025-06-08');
  assert.equal(numeric.rows[0].applicationDate, '2023-05-20');
  const reverse = await service.importIpSummary(1, '101', await ipFile([[...ipExample].reverse()], IP_SUMMARY_FIELDS.map(({ label }) => ` ${label} `).reverse()));
  assert.deepEqual(IP_SUMMARY_FIELDS.map(({ key }) => reverse.rows[0][key]), ipExample);
  const fallback = await service.importIpSummary(1, '101', await ipFile([ipExample], [...IP_SUMMARY_FIELDS.slice(0, 7).map(({ label }) => label), '']));
  assert.equal(fallback.rows[0].grantDate, ipExample[7]);
  const legacyHeaders = [...IP_SUMMARY_FIELDS.slice(0, 6).map(({ label }) => label), '授权日期', '申请日期'];
  const legacyOrder = await service.importIpSummary(1, '101', await ipFile([[...ipExample.slice(0, 6), ipExample[7], ipExample[6]]], legacyHeaders));
  assert.equal(legacyOrder.rows[0].applicationDate, ipExample[6], 'Old labeled templates still map dates correctly');
  assert.equal(legacyOrder.rows[0].grantDate, ipExample[7]);
  for (const [index, { key, label }] of IP_SUMMARY_FIELDS.entries()) {
    if (key === 'number') continue;
    for (const missing of ['', '   ']) {
      const row = [...ipExample];
      row[index] = missing;
      const missingFile = await ipFile([row]);
      await assert.rejects(() => service.importIpSummary(1, '101', missingFile), (error) =>
        error.getStatus() === 400 && error.getResponse().errors.includes(`第2行：请填写${label}`));
    }
  }
  for (const alias of ['专利权有效', '已授权']) {
    const row = [...ipExample];
    row[3] = alias;
    assert.equal((await service.importIpSummary(1, '101', await ipFile([row]))).rows[0].legalStatus, '授权');
  }
  const invalidFile = await ipFile([[], ['IP02', '', '非法类型', '非法状态', '', '', '2023-05-20', '2023-05-19'], [...ipExample.slice(0, 6), '2023-05-20', '2025-02-30']]);
  await assert.rejects(() => service.importIpSummary(1, '101', invalidFile), (error) => {
    const errors = error.getResponse().errors;
    assert.ok(errors.some((text) => /第3行.*请填写名称/u.test(text)));
    assert.ok(errors.some((text) => /第3行.*授权日期不得早于申请日期/u.test(text)));
    assert.ok(errors.some((text) => /第4行.*授权日期不正确/u.test(text)));
    assert.ok(errors.length >= 7, 'All errors, not just the first, are retained');
    return error.getStatus() === 400;
  });
  const formula = [...ipExample];
  formula[4] = { formula: '1+1', result: 2 };
  const formulaFile = await ipFile([formula]);
  await assert.rejects(() => service.importIpSummary(1, '101', formulaFile), (error) => error.getStatus() === 400 && error.getResponse().errors.some((text) => /第2行.*请粘贴为值后导入/u.test(text)));
  await rejects(() => service.importIpSummary(1, '101', { ...file, originalname: 'legacy.xls' }), 400);
  await rejects(() => service.importIpSummary(1, '101', { ...file, buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }), 400);
  await rejects(() => service.importIpSummary(1, '101'), 400);
  await rejects(() => service.importIpSummary(1, '101', { ...file, buffer: Buffer.from('invalid') }), 400);
  const missing = await ipFile([ipExample], undefined, '错误工作表');
  await rejects(() => service.importIpSummary(1, '101', missing), 400);
  const tooMany = await ipFile(Array.from({ length: 201 }, () => ipExample));
  await rejects(() => service.importIpSummary(1, '101', tooMany), 400);
  await rejects(() => service.importIpSummary(2, '101', file), 403);
  await rejects(() => service.ipSummaryTemplate(2, '101'), 403);
  const template = await service.ipSummaryTemplate(1, '101');
  const templateWorkbook = new Workbook();
  await templateWorkbook.xlsx.load(template.buffer);
  assert.deepEqual(templateWorkbook.worksheets.map(({ name }) => name), ['专利证书', '填写说明', '填写示例']);
  assert.deepEqual(templateWorkbook.getWorksheet('专利证书').getRow(1).values.slice(1), IP_SUMMARY_FIELDS.map(({ label }) => label));
  assert.equal(templateWorkbook.getWorksheet('填写说明').rowCount, 14);
  assert.equal(templateWorkbook.getWorksheet('填写示例').rowCount, 3);
  const instructions = templateWorkbook.getWorksheet('填写说明');
  assert.equal(instructions.getCell('B3').value, '名称、专利类型、法律状态、专利号、专利权人、申请日期、授权日期。');
  assert.equal(instructions.getCell('A7').value, '申请日期');
  assert.match(instructions.getCell('B7').value, /^必填/u);
  assert.equal(instructions.getCell('A8').value, '授权日期');
  assert.match(instructions.getCell('B8').value, /^必填/u);
  const examples = templateWorkbook.getWorksheet('填写示例');
  assert.deepEqual(examples.getRow(1).values.slice(1), IP_SUMMARY_FIELDS.map(({ label }) => label));
  assert.equal(examples.getCell('G2').value, '2020-05-20');
  assert.equal(examples.getCell('H2').value, '2023-06-08');
  assert.equal(examples.getCell('G3').value, '2023-09-14');
  assert.equal(examples.getCell('H3').value, '2024-03-20');
  assert.equal((await service.importIpSummary(1, '101', { ...file, buffer: template.buffer, size: template.buffer.length })).total, 0, 'Template examples and styled blank rows do not import');
  const draft = { ...filledDraft(), ipSummary: imported.rows };
  assert.deepEqual(normalizeHighTechDraft(draft).ipSummary, imported.rows);
  for (const { key, label } of IP_SUMMARY_FIELDS) {
    if (key === 'number') continue;
    for (const currentStep of [0, 1, 2]) {
      for (const value of ['', '   ']) {
        const invalid = { ...draft, currentStep, ipSummary: [{ ...imported.rows[0], [key]: value }] };
        assert.throws(() => normalizeHighTechDraft(invalid), (error) =>
          error.getStatus() === 400 && error.message.includes(`第1行：请填写${label}`));
        await assert.rejects(() => service.save(1, '101', invalid), (error) =>
          error.getStatus() === 400 && error.message.includes(`第1行：请填写${label}`));
        assert.equal(entities.has('101'), false, 'Incomplete rows never persist at any step');
      }
    }
  }
  assert.equal(normalizeHighTechDraft({ ...draft, ipSummary: [{ ...imported.rows[0], number: '' }] }).ipSummary[0].number, 'IP01', 'Blank input numbering is assigned automatically');
  for (const changes of [{ name: '' }, { patentType: '非法' }, { legalStatus: '有效' }, { grantDate: '2025-02-30' }, { grantDate: '2022-05-20' }, { patentNumber: 123 }, { patentee: 'x'.repeat(513) }]) {
    assert.throws(() => normalizeHighTechDraft({ ...draft, ipSummary: [{ ...imported.rows[0], ...changes }] }), /第1行/u);
  }
  assert.throws(() => normalizeHighTechDraft({ ...draft, ipSummary: [imported.rows[0], imported.rows[0]] }), /知识产权行标识为空或重复/u);
  assert.throws(() => normalizeHighTechDraft({ ...draft, ipSummary: [{ ...imported.rows[0], id: '' }] }), /知识产权行标识为空或重复/u);
  assert.throws(() => normalizeHighTechDraft({ ...draft, ipSummary: Array.from({ length: 201 }, () => imported.rows[0]) }), /200/u);
  assert.throws(() => normalizeHighTechDraft({ ...draft, ipSummary: null }), /200/u);
  const saved = await service.save(1, '101', draft);
  assert.deepEqual((await service.get(1, '101')).ipSummary, imported.rows);
  const legacy = { ...filledDraft() };
  delete legacy.ipSummary;
  entities.set('102', { draftJson: JSON.stringify(legacy), revision: 1 });
  const loadedLegacy = await service.get(1, '102');
  assert.deepEqual(loadedLegacy.ipSummary, []);
  assert.deepEqual(loadedLegacy.projects, legacy.projects, 'Historical project rows remain untouched');
  assert.deepEqual(normalizeHighTechDraft(legacy).ipSummary, []);
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const controller = new HighTechController(service);
  await controller.importIpSummary({ id: 1 }, '101', invalidFile, response);
  assert.equal(response.statusCode, 400);
  assert.ok(response.body.errors.length >= 7, 'Controller preserves errors despite the shared exception filter');
  await controller.importIpSummary({ id: 1 }, '101', file, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.code, 0);
  assert.equal(response.body.data.total, 2);
  return { rows: imported.rows, saved };
}
async function verifyIpSummaryExport() {
  const { service, entities } = harness();
  const item = Object.fromEntries(IP_SUMMARY_FIELDS.map(({ key }, index) => [key, ipExample[index]]));
  const rows = Array.from({ length: 25 }, (_, index) => ({ ...item, number: `IP${index + 1}`, name: `未保存名称${index + 1}` }));
  rows[0].patentNumber = '00123456.X';
  rows[1].name = '=1+1';
  rows[2].grantDate = '';
  const output = await service.exportIpSummary(1, '101', { rows });
  assert.equal(output.filename, '知识产权汇总表.xlsx');
  const workbook = new Workbook();
  await workbook.xlsx.load(output.buffer);
  assert.equal(workbook.worksheets.length, 1);
  const sheet = workbook.getWorksheet('专利证书');
  assert.equal(sheet.rowCount, 26, 'Export includes every page');
  assert.deepEqual(sheet.getRow(1).values.slice(1), IP_SUMMARY_FIELDS.map(({ label }) => label));
  rows.forEach((row, index) => {
    for (const [column, { key }] of IP_SUMMARY_FIELDS.entries()) assert.equal(sheet.getCell(index + 2, column + 1).value, key === 'number' ? `IP${String(index + 1).padStart(2, '0')}` : row[key]);
  });
  assert.equal(sheet.getCell('B3').type, 3, 'Formula-like input remains plain text');
  assert.equal(sheet.getCell('E2').numFmt, '@', 'Leading-zero identifiers retain text formatting');
  const empty = new Workbook();
  await empty.xlsx.load((await service.exportIpSummary(1, '101', { rows: [] })).buffer);
  assert.equal(empty.getWorksheet('专利证书').rowCount, 1, 'Empty export contains only the header');
  assert.equal(entities.size, 0, 'Export never creates or saves a draft');
  for (const input of [undefined, null, {}, { rows: null }, { rows: [null] }, { rows: [[]] }, { rows: [{ name: { formula: '1+1' } }] }, { rows: [{ name: 'x'.repeat(513) }] }, { rows: Array(201).fill(item) }]) {
    await rejects(() => service.exportIpSummary(1, '101', input), 400);
  }
  await rejects(() => service.exportIpSummary(2, '101', { rows }), 403);
  await rejects(() => service.exportIpSummary(1, '103', { rows }), 403);
}
async function verifyIpSummarySorting() {
  const { service, entities } = harness();
  const item = Object.fromEntries(IP_SUMMARY_FIELDS.map(({ key }, index) => [key, ipExample[index]]));
  const fixtures = [
    ['design-late', '外观设计', '2024-01-01'],
    ['software-late', '软件著作权', '2024-01-01'],
    ['invention-late', '发明专利', '2024-01-01'],
    ['utility-late', '实用新型', '2024-01-01'],
    ['invention-same-z', '发明专利', '2023-01-01'],
    ['utility-early', '实用新型', '2021-01-01'],
    ['invention-early', '发明专利', '2022-01-01'],
    ['software-early', '软件著作权', '2020-01-01'],
    ['invention-same-a', '发明专利', '2023-01-01'],
    ['design-early', '外观设计', '2019-01-01'],
    ['utility-middle', '实用新型', '2022-01-01'],
  ];
  const rows = fixtures.map(([id, patentType, applicationDate], index) => ({
    ...item, id, name: id, number: `IP${index + 1}`, patentType, applicationDate,
  }));
  const expectedIds = [
    'invention-early', 'invention-same-z', 'invention-same-a', 'invention-late',
    'utility-early', 'utility-middle', 'utility-late', 'software-early', 'software-late',
    'design-early', 'design-late',
  ];
  const expected = expectedIds.map((id) => rows.find((row) => row.id === id));
  const assertSheet = (sheet, records) => {
    assert.equal(sheet.rowCount, records.length + 1);
    records.forEach((row, index) => {
      for (const [column, { key }] of IP_SUMMARY_FIELDS.entries()) {
        assert.equal(sheet.getCell(index + 2, column + 1).value, key === 'number' ? `IP${String(index + 1).padStart(2, '0')}` : row[key], `${row.id}: ${key}`);
      }
    });
  };
  const source = structuredClone(rows);
  const standalone = new Workbook();
  await standalone.xlsx.load((await service.exportIpSummary(1, '101', { rows })).buffer);
  assertSheet(standalone.getWorksheet('专利证书'), expected);
  assert.deepEqual(rows, source, 'Export preserves source order and contents');
  assert.equal(entities.size, 0, 'Sorted export does not persist a draft');

  const missing = { ...rows[2], id: 'missing', name: 'missing', applicationDate: '' };
  const invalid = { ...missing, id: 'invalid', name: 'invalid', applicationDate: '2025-02-30' };
  const incomplete = new Workbook();
  await incomplete.xlsx.load((await service.exportIpSummary(1, '101', { rows: [missing, ...rows, invalid] })).buffer);
  assertSheet(incomplete.getWorksheet('专利证书'), [...expected.slice(0, 4), missing, invalid, ...expected.slice(4)]);

  const draft = filledDraft();
  draft.projects[0].ipNumber = 'IP1、IP7, IP3；IP10;IP99';
  const expectedReferences = 'IP11、IP01, IP04；IP10;IP99';
  const normalized = normalizeHighTechDraft({ ...draft, ipSummary: rows });
  assert.equal(normalized.projects[0].ipNumber, expectedReferences);
  assert.deepEqual(normalized.ipSummary.map(({ id }) => id), expectedIds);
  assert.deepEqual(normalized.ipSummary.map(({ number }) => number), expectedIds.map((_, index) => `IP${String(index + 1).padStart(2, '0')}`));
  assert.deepEqual(rows, source, 'Save normalization does not mutate input records');
  const duplicate = { ipSummary: [{ ...rows[0], number: 'duplicate' }, { ...rows[2], number: 'duplicate' }], projects: [{ ipNumber: 'duplicate IP99' }] };
  synchronizeIpNumbers(duplicate);
  assert.equal(duplicate.projects[0].ipNumber, 'duplicate IP99', 'Ambiguous legacy references are not guessed');
  entities.set('102', { draftJson: JSON.stringify({ ...draft, ipSummary: rows }), revision: 1 });
  const legacyJson = entities.get('102').draftJson;
  const loaded = await service.get(1, '102');
  assert.deepEqual(loaded.ipSummary, normalized.ipSummary, 'Legacy drafts are sorted and renumbered on load');
  assert.equal(loaded.projects[0].ipNumber, expectedReferences);
  assert.equal(entities.get('102').draftJson, legacyJson, 'Reading a legacy draft does not rewrite storage');
  const saved = await service.save(1, '101', {
    ...draft, ipSummary: rows, currentStep: 2,
    materials: draft.materials.map((material) => ({ ...material, content: '已核对的材料正文', reviewed: true })),
  });
  const full = new Workbook();
  await full.xlsx.load((await service.export(1, '101')).buffer);
  assertSheet(full.getWorksheet('知识产权汇总表'), expected);
  assert.equal(full.getWorksheet('项目详情表').getCell('E2').value, expectedReferences, 'Full export uses the synchronized project references');
  assert.equal(saved.projects[0].ipNumber, expectedReferences);
  assert.deepEqual((await service.get(1, '101')).ipSummary, saved.ipSummary, 'Full export preserves stored records and numbering');
}
async function verifyRequestLimits() {
  const adapter = new ExpressAdapter();
  adapter.use(highTechDraftBodyParser);
  // Match production middleware registration, including Nest's parser-name check.
  adapter.registerParserMiddleware('', true);
  const handler = (request, response) => response.json({
    length: request.body.text.length,
    rawBytes: request.rawBody.length,
  });
  adapter.put('/client/companies/:companyId/high-tech-application', handler);
  adapter.post('/unrelated', handler);
  adapter.post('/client/companies/:companyId/high-tech-application/project-details/export', handler);
  adapter.use((error, _request, response, _next) => response.status(error.status || 500).json({ message: error.message }));
  const server = adapter.getInstance().listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const send = (path, method, text) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    const text = '材'.repeat(100000);
    const large = await send('/client/companies/101/high-tech-application', 'PUT', text);
    assert.equal(large.status, 200, 'Long Chinese drafts exceed the default 100KB limit but must save');
    assert.deepEqual(await large.json(), { length: text.length, rawBytes: Buffer.byteLength(JSON.stringify({ text })) });
    assert.equal((await send('/client/companies/101/high-tech-application/project-details/export', 'POST', text)).status, 200, 'Large project exports accept the editor snapshot');
    assert.equal((await send('/unrelated', 'POST', text)).status, 413, 'Unrelated endpoints retain their existing request limits');
    const small = await send('/unrelated', 'POST', 'small');
    assert.equal(small.status, 200, 'Nest must still register its default JSON parser');
    assert.equal((await small.json()).length, 5);
    assert.equal((await send('/client/companies/101/high-tech-application', 'PUT', 'x'.repeat(10 * 1024 * 1024))).status, 413, 'High-tech requests still have a bounded size');
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}
async function verifyIpSummaryHttp() {
  const { service } = harness();
  const guards = Reflect.getMetadata(GUARDS_METADATA, HighTechController);
  // Only authentication is mocked; exercise real routing, multipart and response handling.
  Reflect.defineMetadata(GUARDS_METADATA, [{ canActivate(context) {
    context.switchToHttp().getRequest().currentUser = { id: 1, portal: 'client' };
    return true;
  } }], HighTechController);
  class VerificationModule {}
  Module({ controllers: [HighTechController], providers: [{ provide: HighTechService, useValue: service }] })(VerificationModule);
  let app;
  try {
    app = await NestFactory.create(VerificationModule, { logger: false });
    app.use(highTechDraftBodyParser);
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const projectPath = `${base}/client/companies/101/high-tech-application/project-details`;
    const emptyProjects = await fetch(`${projectPath}/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: [] }) });
    assert.equal(emptyProjects.status, 201);
    assert.ok(emptyProjects.headers.get('content-type').includes('spreadsheetml.sheet'));
    const projectBuffer = Buffer.from(await emptyProjects.arrayBuffer());
    const projectUpload = async (buffer) => {
      const body = new FormData();
      body.append('file', new Blob([buffer]), '项目详情.xlsx');
      return fetch(`${projectPath}/import`, { method: 'POST', body });
    };
    const emptyImport = await projectUpload(projectBuffer);
    assert.equal(emptyImport.status, 200);
    assert.deepEqual((await emptyImport.json()).data, { rows: [], total: 0 });
    const brokenProject = new Workbook();
    await brokenProject.xlsx.load(projectBuffer);
    brokenProject.getWorksheet('项目详情表').addRow(['RD01', '无效年份']);
    const invalidProject = await projectUpload(Buffer.from(await brokenProject.xlsx.writeBuffer()));
    assert.equal(invalidProject.status, 400);
    assert.ok((await invalidProject.json()).errors.some((error) => error.includes('第2行')));
    const path = '/client/companies/101/high-tech-application/ip-summary';
    const upload = (file) => {
      const body = new FormData();
      body.append('file', new Blob([file.buffer]), file.originalname);
      return fetch(`${base}${path}/import`, { method: 'POST', body });
    };
    const valid = await upload(await ipFile([ipExample, ipExample]));
    assert.equal(valid.status, 200, 'Multipart requests bypass the draft JSON parser');
    const data = await valid.json();
    assert.equal(data.code, 0);
    assert.equal(data.data.total, 2);
    assert.deepEqual((await service.get(1, '101')).ipSummary, [], 'HTTP import never autosaves');
    const invalid = await upload(await ipFile([['IP01', '', '非法', '', '', '', '2025-02-30']]));
    assert.equal(invalid.status, 400);
    const errors = await invalid.json();
    assert.equal(errors.code, 400);
    assert.ok(errors.errors.length >= 6, 'Global response handling preserves every row error');
    assert.ok(errors.errors.every((text) => /第2行/u.test(text)));
    const download = await fetch(`${base}${path}/template`);
    assert.equal(download.status, 200);
    assert.match(download.headers.get('content-type'), /spreadsheetml/u);
    assert.match(download.headers.get('content-disposition'), /attachment/u);
    const workbook = new Workbook();
    await workbook.xlsx.load(Buffer.from(await download.arrayBuffer()));
    assert.ok(workbook.getWorksheet('专利证书'));
    const exportRows = Array.from({ length: 200 }, (_, index) => ({ number: `IP${index + 1}`, name: '知'.repeat(512) }));
    for (const rows of [[], exportRows]) {
      const response = await fetch(`${base}${path}/export`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }),
      });
      assert.equal(response.status, 201);
      assert.match(response.headers.get('content-type'), /spreadsheetml/u);
      assert.ok(response.headers.get('content-disposition').includes(encodeURIComponent('知识产权汇总表.xlsx')));
      const exported = new Workbook();
      await exported.xlsx.load(Buffer.from(await response.arrayBuffer()));
      assert.equal(exported.getWorksheet('专利证书').rowCount, rows.length + 1, 'Empty and large HTTP exports succeed');
    }
    assert.deepEqual((await service.get(1, '101')).ipSummary, [], 'HTTP export never autosaves');
  } finally {
    if (app) {
      app.getHttpServer().closeAllConnections();
      await app.close();
    }
    Reflect.defineMetadata(GUARDS_METADATA, guards, HighTechController);
  }
}
function verifyDefaultProjects() {
  for (const [now, firstYear] of [
    ['2026-10-01T04:00:00Z', 2023],
    ['2025-12-31T15:59:59.999Z', 2022],
    ['2025-12-31T16:00:00.000Z', 2023],
    ['2026-12-31T15:59:59.999Z', 2023],
    ['2026-12-31T16:00:00.000Z', 2024],
  ]) {
    const draft = { ...emptyHighTechDraft(new Date(now)), revision: 0 };
    assert.deepEqual(draft.projects.map(({ rdNumber, year }) => ({ rdNumber, year })), Array.from({ length: 9 }, (_, index) => ({
      rdNumber: `RD${String(index + 1).padStart(2, '0')}`,
      year: firstYear + Math.floor(index / 3),
    })).flatMap((row) => [row, row]), `Default years follow Beijing time at ${now}`);
    assert.equal(new Set(draft.projects.map(({ id }) => id)).size, 18);
    assert.deepEqual(draft.projects.map((row) => row.achievementNumber), Array.from({ length: 18 }, (_, index) => `成果${String(index + 1).padStart(2, '0')}`));
    for (let index = 0; index < draft.projects.length; index += 2) {
      const first = draft.projects[index];
      const second = draft.projects[index + 1];
      for (const field of ['rdNumber', 'year', 'activityName', 'researchPeriod']) assert.equal(second[field], first[field]);
    }
    for (const row of draft.projects) {
      for (const { key } of PROJECT_FIELDS) {
        if (!['rdNumber', 'year', 'researchPeriod', 'achievementNumber'].includes(key)) assert.equal(row[key], '');
      }
    }
    for (const year of [firstYear, firstYear + 1, firstYear + 2]) {
      const rows = draft.projects.filter((row) => row.year === year);
      const ranges = rows.map((row) => row.researchPeriod.split('—').map((date) => Date.parse(`${date}T00:00:00Z`)));
      for (const [start, end] of ranges) {
        assert.equal(new Date(end).getUTCMonth() - new Date(start).getUTCMonth() + 1, 8);
        assert.equal(new Date(start).getUTCFullYear(), year);
        assert.equal(new Date(end).getUTCFullYear(), year);
      }
      for (let day = Date.UTC(year, 0, 1); day <= Date.UTC(year, 11, 31); day += 86400000) {
        assert.ok(ranges.some(([start, end]) => start <= day && day <= end), `Missing coverage on ${new Date(day).toISOString()}`);
      }
    }
    assert.deepEqual(normalizeHighTechDraft(draft).projects, draft.projects, 'Default rows can be saved before completing their details');
    assert.deepEqual(normalizeHighTechDraft({ ...draft, projects: [] }).projects, [], 'Saving must not regenerate deleted rows');
  }
  const first = emptyHighTechDraft();
  const second = emptyHighTechDraft();
  assert.equal(new Set([...first.projects, ...second.projects].map(({ id }) => id)).size, 36, 'New drafts do not share project identifiers');
}
async function verifyResearchPeriodPersistence() {
  const { service } = harness();
  const draft = filledDraft();
  const defaults = emptyHighTechDraft(new Date('2026-10-01T04:00:00Z')).projects;
  draft.projects = defaults.map((row) => ({
    ...draft.projects[0], id: row.id, rdNumber: row.rdNumber, year: row.year, researchPeriod: row.researchPeriod,
  }));
  draft.projects[0].researchPeriod = '2023.02—2023.09';
  draft.materials[0].content = '研发周期导出验证材料';
  const expected = draft.projects.map((row) => row.researchPeriod);
  await service.save(1, '101', draft);
  assert.deepEqual((await service.get(1, '101')).projects.map((row) => row.researchPeriod), expected, 'Both existing and automatic periods survive save and reload');
  const workbook = new Workbook();
  await workbook.xlsx.load((await service.export(1, '101')).buffer);
  expected.forEach((period, index) => assert.equal(workbook.getWorksheet('项目详情表').getCell(`D${index + 2}`).value, period));
}
async function verifyBranchExport() {
  const { service } = harness();
  const draft = filledDraft();
  const first = { ...draft.projects[0], rdNumber: 'RD01', achievementNumber: '成果01', researchPeriod: '2026-01-01—2026-08-31' };
  const branch = { ...first, id: 'row-branch', ipName: '分支知识产权', achievementNumber: '成果02', achievementName: '分支成果' };
  const second = { ...first, id: 'row-second', rdNumber: 'RD02', achievementNumber: '成果03' };
  draft.projects = [first, branch, second];
  draft.materials[0].content = '分支导出验证材料';
  const saved = await service.save(1, '101', draft);
  assert.deepEqual((await service.get(1, '101')).projects, draft.projects, 'Branches survive saving and reloading');
  const workbook = new Workbook();
  await workbook.xlsx.load((await service.export(1, '101')).buffer);
  const sheet = workbook.getWorksheet('项目详情表');
  assert.deepEqual(new Set(sheet.model.merges), new Set(['A2:A3', 'B2:B3', 'C2:C3', 'D2:D3']));
  assert.equal(sheet.getCell('F3').value, '分支知识产权');
  assert.equal(sheet.getCell('N3').value, '分支成果');
  assert.deepEqual([2, 3, 4].map((row) => sheet.getCell(`M${row}`).value), ['成果01', '成果02', '成果03']);
  assert.equal(sheet.getCell('A4').value, 'RD02');
  saved.projects[1].activityName = '历史项目名称冲突';
  saved.projects[1].researchPeriod = '2026-02-01—2026-09-30';
  await service.save(1, '101', saved);
  const conflicts = new Workbook();
  await conflicts.xlsx.load((await service.export(1, '101')).buffer);
  const conflictSheet = conflicts.getWorksheet('项目详情表');
  assert.deepEqual(conflictSheet.model.merges, [], 'Any conflicting group field prevents all four columns from merging');
  assert.equal(conflictSheet.getCell('C3').value, '历史项目名称冲突');
  assert.equal(conflictSheet.getCell('D3').value, '2026-02-01—2026-09-30');
}
async function verifyProjectDetailsMerging() {
  const base = { ...filledDraft().projects[0], rdNumber: 'RD01', researchPeriod: '2026-01-01—2026-08-31',
    ipType: '发明专利', acquisitionMethod: '原始取得', psName: '产品名称' };
  const different = { rdNumber: 'RD02', year: 2025, activityName: '不同活动名称', researchPeriod: '2026-02-01—2026-09-30' };
  const cases = [
    { name: 'empty', changes: [], ranges: [] },
    { name: 'single row', changes: [{}], ranges: [] },
    { name: 'two matching rows', changes: [{}, {}], ranges: [[2, 3]] },
    { name: 'three matching rows at the end', changes: [{}, {}, {}], ranges: [[2, 4]] },
    ...Object.entries(different).map(([key, value]) => ({ name: `${key} mismatch`, changes: [{}, { [key]: value }], ranges: [] })),
    { name: 'nonadjacent duplicates', changes: [{}, { rdNumber: 'RD02' }, {}], ranges: [] },
    { name: 'matching subgroup within one RD', changes: [{}, { activityName: '不同活动名称' }, { activityName: '不同活动名称' }], ranges: [[3, 4]] },
    { name: 'separate adjacent groups', changes: [{}, {}, { rdNumber: 'RD02' }, { rdNumber: 'RD02' }, { rdNumber: 'RD02' }, {}], ranges: [[2, 3], [4, 6]] },
  ];
  for (const { name, changes, ranges } of cases) {
    const { service, entities } = harness();
    const rows = changes.map((change, index) => ({ ...base, ...change, id: `merge-row-${index}`,
      ipName: `知识产权${index}`, achievementName: `成果名称${index}`, achievementNumber: `成果${index + 1}` }));
    const standalone = await service.exportProjectDetails(1, '101', { rows });
    const exports = [['standalone', standalone.buffer]];
    if (rows.length) {
      const draft = filledDraft();
      draft.projects = rows;
      draft.materials[0].content = '合并规则验证材料';
      await service.save(1, '101', draft);
      exports.push(['full', (await service.export(1, '101')).buffer]);
    }
    for (const [kind, buffer] of exports) {
      const workbook = new Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.getWorksheet('项目详情表');
      const expectedMerges = ranges.flatMap(([start, end]) => ['A', 'B', 'C', 'D'].map((column) => `${column}${start}:${column}${end}`));
      assert.deepEqual(new Set(sheet.model.merges), new Set(expectedMerges), `${kind}: ${name}`);
      assert.equal(sheet.rowCount, rows.length + 1, `${kind}: ${name} preserves row count`);
      rows.forEach((row, index) => PROJECT_FIELDS.forEach(({ key }, column) => {
        const expected = key === 'psNumber' && row.psName ? `${row.psNumber}\n${row.psName}` : row[key];
        assert.equal(sheet.getCell(index + 2, column + 1).value, expected, `${kind}: ${name} preserves row ${index + 1} ${key}`);
      }));
      const imported = await service.importProjectDetails(1, '101', { originalname: '项目详情.xlsx', buffer });
      assert.deepEqual(imported.rows.map(({ id, ...row }) => row), rows.map(({ id, ...row }) => row), `${kind}: ${name} round-trips every row`);
    }
    if (!rows.length) assert.equal(entities.size, 0);
  }
}
async function verifyBasicInfo() {
  const { service, entities } = harness();
  const draft = { ...emptyHighTechDraft(), revision: 0 };
  const info = { salesRevenue: 1200.25, employeeCount: 30, insuredEmployeeCount: 28, patentCount: 10, inventionPatentCount: 2, utilityModelCount: 3, softwareCopyrightCount: 5, hasRdExpenses: false };
  const saved = await service.save(1, '101', { ...draft, basicInfo: info });
  assert.deepEqual(saved.basicInfo, info);
  assert.deepEqual((await service.get(1, '101')).basicInfo, info);
  for (const key of Object.keys(info).filter((key) => key !== 'hasRdExpenses')) {
    for (const value of [-1, '2', true, NaN, Infinity, ...(key === 'salesRevenue' ? [] : [1.5, Number.MAX_SAFE_INTEGER + 1])]) {
      assert.throws(() => normalizeHighTechDraft({ ...draft, basicInfo: { ...info, [key]: value } }), /非负/);
    }
  }
  assert.throws(() => normalizeHighTechDraft({ ...draft, basicInfo: { ...info, insuredEmployeeCount: 31 } }), /不能超过/);
  for (const value of ['false', 0, 1]) {
    assert.throws(() => normalizeHighTechDraft({ ...draft, basicInfo: { ...info, hasRdExpenses: value } }), /研发费用/);
  }
  const zero = Object.fromEntries(Object.keys(info).map((key) => [key, key === 'hasRdExpenses' ? false : 0]));
  assert.deepEqual(normalizeHighTechDraft({ ...draft, basicInfo: zero }).basicInfo, zero);
  const legacy = { ...draft };
  delete legacy.basicInfo;
  assert.deepEqual(normalizeHighTechDraft(legacy).basicInfo, draft.basicInfo);
  entities.set('102', { draftJson: JSON.stringify(legacy), revision: 1 });
  assert.deepEqual((await service.get(1, '102')).basicInfo, draft.basicInfo);
  assert.deepEqual(normalizeHighTechDraft({ ...draft, basicInfo: { salesRevenue: 12.5 } }).basicInfo, { ...draft.basicInfo, salesRevenue: 12.5 });
  const updated = await service.save(1, '101', { ...saved, basicInfo: { ...info, hasRdExpenses: true } });
  assert.equal(updated.basicInfo.hasRdExpenses, true);
  await rejects(() => service.save(1, '101', { ...saved, basicInfo: { ...info, employeeCount: -1 } }), 400);
  assert.deepEqual((await service.get(1, '101')).basicInfo, updated.basicInfo);
}
async function verifyUnlinkedAcquisitionMethods() {
  const { service, entities } = harness();
  const draft = filledDraft();
  draft.currentStep = 2;
  const row = draft.projects[0];
  for (const key of ['ipNumber', 'ipName', 'authorizationNumber', 'applicationDate', 'authorizationDate', 'ipType']) row[key] = '';
  row.acquisitionMethod = '原始取得';
  assert.equal(normalizeHighTechDraft(draft).projects[0].acquisitionMethod, '');
  const saved = await service.save(1, '101', draft);
  assert.equal(saved.projects[0].acquisitionMethod, '');
  assert.equal(JSON.parse(entities.get('101').draftJson).projects[0].acquisitionMethod, '');
  const legacy = { ...draft, projects: [{ ...row, ipNumber: ' ', ipName: '历史名称' }] };
  entities.get('101').draftJson = JSON.stringify(legacy);
  const loaded = await service.get(1, '101');
  assert.equal(loaded.projects[0].acquisitionMethod, '');
  assert.equal(loaded.projects[0].ipName, '历史名称', 'Normalization does not delete orphan historical IP text');
  const linked = filledDraft();
  linked.currentStep = 2;
  linked.projects[0].acquisitionMethod = '';
  assert.throws(() => normalizeHighTechDraft(linked), /取得方式/, 'Linked IPs still require acquisition method');

  const workbook = new Workbook();
  await workbook.xlsx.load((await service.exportProjectDetails(1, '101', { rows: [row] })).buffer);
  const sheet = workbook.getWorksheet('项目详情表');
  const column = PROJECT_FIELDS.findIndex(({ key }) => key === 'acquisitionMethod') + 1;
  assert.equal(sheet.getRow(2).getCell(column).text, '', 'Unlinked exported acquisition is empty');
  sheet.getRow(2).getCell(column).value = '原始取得';
  const imported = await service.importProjectDetails(1, '101', {
    originalname: 'unlinked.xlsx', buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  assert.equal(imported.rows[0].acquisitionMethod, '', 'Legacy Excel acquisition is cleared for unlinked rows');
}
async function verifyProjectDetails() {
  const { service, entities } = harness();
  const exported = await service.exportProjectDetails(1, '101', { rows: [] });
  const workbook = new Workbook();
  await workbook.xlsx.load(exported.buffer);
  const sheet = workbook.getWorksheet('项目详情表');
  assert.deepEqual(sheet.getRow(1).values.slice(1), PROJECT_FIELDS.map(({ label }) => label));
  assert.equal(sheet.rowCount, 1);
  const file = async () => ({ originalname: '项目详情.xlsx', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) });
  assert.equal((await service.importProjectDetails(1, '101', await file())).total, 0);
  const rows = emptyHighTechDraft().projects.slice(0, 2).map((row, index) => ({ ...row,
    ipNumber: `IP0${index + 1}`,
    authorizationNumber: '001234', applicationDate: '2023-01-01', authorizationDate: '2024-02-29', ipType: '发明专利',
    acquisitionMethod: '原始取得', psNumber: index ? '' : 'PS01', psName: '产品名称',
  }));
  const filled = await service.exportProjectDetails(1, '101', { rows });
  await workbook.xlsx.load(filled.buffer);
  const details = workbook.getWorksheet('项目详情表');
  assert.deepEqual(new Set(details.model.merges), new Set(['A2:A3', 'B2:B3', 'C2:C3', 'D2:D3']));
  const imported = await service.importProjectDetails(1, '101', await file());
  assert.equal(imported.total, 2);
  imported.rows.forEach((row, index) => {
    assert.notEqual(row.id, rows[index].id);
    assert.deepEqual({ ...row, id: '' }, { ...rows[index], id: '' });
  });
  assert.equal(entities.size, 0, 'Project import and export never persist drafts');
  const legacyWorkbook = new Workbook();
  const legacySheet = legacyWorkbook.addWorksheet('项目详情表');
  const legacyFields = PROJECT_FIELDS.filter(({ key }) => key !== 'applicationDate');
  legacySheet.addRow(legacyFields.map(({ label }) => label));
  legacySheet.addRow(legacyFields.map(({ key }) => rows[0][key]));
  const legacy = await service.importProjectDetails(1, '101', { originalname: 'legacy.xlsx', buffer: Buffer.from(await legacyWorkbook.xlsx.writeBuffer()) });
  assert.equal(legacy.rows[0].applicationDate, '');
  assert.equal(legacy.rows[0].authorizationDate, rows[0].authorizationDate);
  assert.equal(legacy.rows[0].ipType, rows[0].ipType);
  details.getCell('H2').value = new Date('2023-03-20T00:00:00Z');
  assert.equal((await service.importProjectDetails(1, '101', await file())).rows[0].applicationDate, '2023-03-20');
  details.getCell('H2').value = '2023-02-30';
  await assert.rejects(() => file().then((file) => service.importProjectDetails(1, '101', file)), (error) => error.getResponse().errors.some((message) => message.includes('申请日期')));
  details.getCell('H2').value = '2025-01-01';
  await assert.rejects(() => file().then((file) => service.importProjectDetails(1, '101', file)), (error) => error.getResponse().errors.some((message) => message.includes('不得早于')));
  details.getCell('H2').value = rows[0].applicationDate;
  details.getCell('I2').value = new Date('2024-03-20T00:00:00Z');
  assert.equal((await service.importProjectDetails(1, '101', await file())).rows[0].authorizationDate, '2024-03-20');
  details.getCell('I2').value = '2024-02-30';
  details.getCell('J3').value = '未知类型';
  details.getCell('G3').value = { formula: '1+1', result: 2 };
  await assert.rejects(() => file().then((file) => service.importProjectDetails(1, '101', file)), (error) => error.getResponse().errors.length >= 3);
  details.getCell('A1').value = '错误表头';
  await rejects(() => file().then((file) => service.importProjectDetails(1, '101', file)), 400);
  await rejects(() => service.importProjectDetails(1, '101', { originalname: 'test.xlsm', buffer: filled.buffer }), 400);
  await rejects(() => service.importProjectDetails(1, '101', { originalname: 'bad.xlsx', buffer: Buffer.from('invalid') }), 400);
  await rejects(() => service.exportProjectDetails(2, '101', { rows: [] }), 403);
  await rejects(() => service.importProjectDetails(2, '101', { originalname: 'test.xlsx', buffer: filled.buffer }), 403);
  await rejects(() => service.exportProjectDetails(1, '101', { rows: Array(201).fill(rows[0]) }), 400);
  await workbook.xlsx.load(exported.buffer);
  const many = workbook.getWorksheet('项目详情表');
  for (let index = 0; index < 201; index++) many.addRow(['RD01']);
  await rejects(() => file().then((file) => service.importProjectDetails(1, '101', file)), 400);
}
async function verifySelfAssessment() {
  const { service, entities, revoke } = harness();
  const empty = await service.getScores(1, '101');
  assert.equal(empty.revision, 0);
  assert.equal(completedHighTechSelfScore(empty.scores), null);
  assert.equal(entities.size, 0, 'Opening the assessment must not save a draft');

  const incomplete = { ...empty.scores, intellectualProperty: 0, transformation: 10, organization: 5, salesGrowth: 2 };
  assert.equal(completedHighTechSelfScore(incomplete), null);
  await rejects(() => service.saveScores(1, '101', { revision: 0, scores: incomplete }), 400);
  assert.equal(entities.size, 0, 'Rejected assessment must not appear as saved');
  for (const field of SCORE_FIELDS) {
    const invalid = { ...incomplete, netAssetGrowth: 0, [field.key]: field.max + 1 };
    await rejects(() => service.saveScores(1, '101', { revision: 0, scores: invalid }), 400);
    assert.equal(completedHighTechSelfScore(invalid), null);
  }

  const zeros = Object.fromEntries(SCORE_FIELDS.map(({ key }) => [key, 0]));
  const savedZeros = await service.saveScores(1, '101', { revision: 0, scores: zeros });
  assert.equal(savedZeros.revision, 1);
  assert.equal(completedHighTechSelfScore(JSON.parse(entities.get('101').draftJson).scores), 0);
  assert.deepEqual((await service.getScores(1, '101')).scores, zeros);
  assert.equal((await service.getScores(1, '102')).revision, 0, 'Other companies have independent assessments');
  await rejects(() => service.saveScores(1, '101', { revision: 0, scores: zeros }), 409);

  const legacy = filledDraft();
  legacy.currentStep = 1;
  legacy.materials[0].content = '已有材料内容';
  legacy.extraLegacyData = { keep: true };
  entities.set('102', { enterpriseId: '102', revision: 7, draftJson: JSON.stringify(legacy) });
  assert.equal(completedHighTechSelfScore((await service.getScores(1, '102')).scores), 100);
  const updatedScores = { ...legacy.scores, intellectualProperty: 25 };
  const saved = await service.saveScores(1, '102', { revision: 7, scores: updatedScores });
  assert.equal(saved.revision, 8);
  assert.equal(completedHighTechSelfScore(JSON.parse(entities.get('102').draftJson).scores), 95);
  assert.deepEqual(JSON.parse(entities.get('102').draftJson), { ...legacy, scores: updatedScores }, 'Assessment save must preserve legacy and material fields');
  await rejects(() => service.saveScores(1, '102', { revision: 7, scores: zeros }), 409);
  await rejects(() => service.getScores(2, '101'), 403);
  await rejects(() => service.saveScores(2, '101', { revision: 1, scores: zeros }), 403);
  await rejects(() => service.getScores(1, '103'), 403);
  await rejects(() => service.getScores(1, '../101'), 400);
  revoke();
  await rejects(() => service.getScores(1, '101'), 403);
}
async function main() {
  await verifySelfAssessment();
  await verifyUnlinkedAcquisitionMethods();
  await verifyProjectDetails();
  await verifyProjectDetailsMerging();
  await verifyBasicInfo();
  await verifyBranchExport();
  await verifyResearchPeriodPersistence();
  const { rows: ipRows } = await verifyIpSummary();
  verifyDefaultProjects();
  await verifyIpSummaryExport();
  await verifyIpSummarySorting();
  await verifyRequestLimits();
  await verifyIpSummaryHttp();
  assert.equal(PROJECT_FIELDS.length, 15);
  const draft = filledDraft();
  assert.deepEqual(normalizeHighTechDraft(draft).scores, draft.scores);
  for (const field of SCORE_FIELDS) {
    for (const value of [-1, field.max + 1, NaN, Infinity, '10']) {
      assert.throws(() => normalizeHighTechDraft({ ...draft, scores: { ...draft.scores, [field.key]: value } }), /分数/);
    }
  }
  assert.equal(normalizeHighTechDraft({ ...emptyHighTechDraft(), revision: 0, currentStep: 1 }).currentStep, 1);
  assert.throws(() => normalizeHighTechDraft({ ...draft, currentStep: 2, projects: [] }), /至少/);
  assert.throws(() => normalizeHighTechDraft({ ...draft, projects: [draft.projects[0], draft.projects[0]] }), /重复/);
  assert.throws(() => normalizeHighTechDraft({ ...draft, projects: [{ ...draft.projects[0], authorizationDate: '2026-02-30' }] }), /日期/);
  assert.throws(() => normalizeHighTechDraft({ ...draft, projects: [{ ...draft.projects[0], applicationDate: '2025-02-30' }] }), /申请日期/);
  assert.throws(() => normalizeHighTechDraft({ ...draft, projects: [{ ...draft.projects[0], applicationDate: '2026-10-02' }] }), /不得早于/);
  const legacyRow = { ...draft.projects[0] };
  delete legacyRow.applicationDate;
  assert.equal(normalizeHighTechDraft({ ...draft, currentStep: 2, projects: [legacyRow] }).projects[0].applicationDate, '');
  assert.throws(() => normalizeHighTechDraft({ ...draft, projects: [{ ...draft.projects[0], year: 2026.5 }] }), /年份/);
  assert.throws(() => normalizeHighTechDraft({ ...draft, currentStep: 2, projects: [{ ...draft.projects[0], psNumber: '' }] }), /对应PS/);
  assert.throws(() => normalizeHighTechDraft({ ...draft, materials: [] }), /材料/);
  const placeholder = filledDraft();
  placeholder.materials[0] = { key: 'research', content: '【待补充：研发活动】', reviewed: true };
  assert.throws(() => normalizeHighTechDraft(placeholder), /待补充/);
  const { service, revoke } = harness();
  const initial = await service.get(1, '101');
  assert.equal(initial.revision, 0);
  assert.equal(initial.updatedAt, null);
  assert.equal(initial.projects.length, 18);
  const currentYear = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date()));
  assert.deepEqual(initial.projects.map(({ year }) => year), [currentYear - 3, currentYear - 3, currentYear - 3, currentYear - 2, currentYear - 2, currentYear - 2, currentYear - 1, currentYear - 1, currentYear - 1].flatMap((year) => [year, year]));
  const defaultsService = harness().service;
  const savedDefaults = await defaultsService.save(1, '101', initial);
  assert.deepEqual((await defaultsService.get(1, '101')).projects, initial.projects, 'Default project IDs and years survive save and reload');
  await defaultsService.save(1, '101', { ...savedDefaults, projects: [] });
  assert.deepEqual((await defaultsService.get(1, '101')).projects, [], 'Explicitly cleared saved drafts stay empty');
  await rejects(() => service.get(2, '101'), 403);
  await rejects(() => service.get(1, '999'), 403);
  await rejects(() => service.get(1, '103'), 403);
  await rejects(() => service.get(1, '../101'), 400);
  await rejects(() => service.save(2, '101', draft), 403);
  draft.ipSummary = ipRows;
  const saved = await service.save(1, '101', draft);
  assert.equal(saved.revision, 1);
  assert.deepEqual((await service.get(1, '101')).projects, draft.projects);
  const otherCompany = await service.get(1, '102');
  assert.equal(otherCompany.projects.length, 18, 'Other companies receive their own default projects');
  assert.equal(otherCompany.projects[0].activityName, '', 'Drafts are isolated by company');
  assert.equal(new Set([...initial.projects, ...otherCompany.projects].map(({ id }) => id)).size, 36);
  await rejects(() => service.save(1, '101', draft), 409);
  const next = await service.save(1, '101', { ...saved, currentStep: 2, materials: saved.materials.map((item) => ({ ...item, content: '已核对的材料正文\n=HYPERLINK("example")', reviewed: true })) });
  await rejects(() => service.save(1, '101', saved), 409);
  assert.equal(next.revision, 2);
  const { buffer, filename } = await service.export(1, '101');
  assert.ok(filename.endsWith('.xlsx'));
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  assert.equal(workbook.worksheets.length, 8);
  assert.deepEqual(workbook.worksheets.slice(0, 3).map(({ name }) => name), ['自评分', '知识产权汇总表', '项目详情表']);
  const ipSheet = workbook.getWorksheet('知识产权汇总表');
  assert.deepEqual(ipSheet.getRow(1).values.slice(1), IP_SUMMARY_FIELDS.map(({ label }) => label));
  assert.deepEqual(ipSheet.getRow(2).values.slice(1), IP_SUMMARY_FIELDS.map(({ key }) => ipRows[0][key]));
  assert.equal(ipSheet.getCell('E2').type, 3);
  assert.equal(ipSheet.getColumn(2).width, 30);
  assert.equal(ipSheet.getColumn(6).width, 30);
  assert.equal(ipSheet.getCell('A1').font.bold, true);
  assert.equal(ipSheet.views[0].ySplit, 1);
  assert.equal(ipSheet.autoFilter, 'A1:H1');
  assert.deepEqual(workbook.getWorksheet('项目详情表').getRow(1).values.slice(1), PROJECT_FIELDS.map((field) => field.label));
  assert.equal(workbook.getWorksheet('项目详情表').getCell('A2').value, draft.projects[0].rdNumber);
  assert.equal(workbook.getWorksheet('项目详情表').getCell('D2').value, draft.projects[0].researchPeriod, 'Export preserves the saved research period');
  assert.equal(workbook.getWorksheet('研发活动说明').getCell('A5').type, 3, 'User input is a string, never a spreadsheet formula');
  assert.equal(workbook.getWorksheet('自评分').getCell('B9').value, 100);
  const decimalDraft = filledDraft();
  decimalDraft.scores = { intellectualProperty: 0.1, transformation: 0.2, organization: 0, salesGrowth: 0, netAssetGrowth: 0 };
  decimalDraft.currentStep = 2;
  decimalDraft.materials[0].content = '小数分数导出校验';
  await service.save(1, '102', decimalDraft);
  const decimalWorkbook = new Workbook();
  await decimalWorkbook.xlsx.load((await service.export(1, '102')).buffer);
  assert.equal(decimalWorkbook.getWorksheet('自评分').getCell('B9').value, 0.3);
  assert.equal(decimalWorkbook.getWorksheet('知识产权汇总表').rowCount, 1, 'Empty summary exports headers only');
  await rejects(() => service.export(2, '101'), 403);
  revoke();
  await rejects(() => service.get(1, '101'), 403);
  await rejects(() => service.save(1, '101', next), 403);
  await rejects(() => service.export(1, '101'), 403);
  console.log('High-tech verification passed: nine default RDs with two branches and eighteen achievements, Beijing year boundaries, score limits, detail validation, company isolation, revoked access, conflict protection, persisted drafts, scoped request limits, XLSX export and ip summary import/export.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
