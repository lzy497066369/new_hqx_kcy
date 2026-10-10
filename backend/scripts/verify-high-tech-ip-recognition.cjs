const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { Module } = require('@nestjs/common');
const { GUARDS_METADATA } = require('@nestjs/common/constants');
const { NestFactory } = require('@nestjs/core');
const { ResponseInterceptor } = require('../dist/common/interceptors/response.interceptor');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const { HighTechService } = require('../dist/modules/client/high-tech/high-tech.service');
const { HighTechController } = require('../dist/modules/client/high-tech/high-tech.controller');
const { HighTechIpRecognitionService } = require('../dist/modules/client/high-tech/high-tech-ip-recognition.service');
const pdfParse = require('pdf-parse');

// Synthetic documents only: no business documents or live external calls.
function pdf(text = '', pageCount = 1) {
  const commands = `BT /F1 12 Tf 50 750 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj ET`;
  const pages = Array.from({ length: pageCount }, (_, index) => 5 + index);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`,
    ...pages.map(() => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 4 0 R >>'),
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => { offsets.push(Buffer.byteLength(output)); output += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output);
}
const example = {
  name: '测试知识产权', patentType: '实用新型专利', legalStatus: '有效', patentNumber: 'ZL 00123456.X',
  patentee: '测试企业', grantDate: '2025年3月2日', applicationDate: '2024/2/29',
};
const textPdf = () => pdf('Patent certificate registration number 00123456.X owner Synthetic Company application date 2024-02-29 grant date 2025-03-02 only synthetic verification data.');
const file = (buffer = textPdf(), originalname = 'certificate.pdf') => ({ buffer, originalname });
const calls = [];
let answer = { rows: [example] };
const ai = { chat: async (input) => { calls.push(input); return { content: typeof answer === 'string' ? answer : JSON.stringify(answer), model: 'fake-test-model' }; } };
const service = new HighTechIpRecognitionService(ai);
const companyClient = { getClientCompanies: async (id) => id === 1 ? [
  { id: '101', enterpriseProjects: ['国家高新技术企业'] },
  { id: '102', enterpriseProjects: ['其他项目'] },
] : [] };
const noPersistence = new Proxy({}, { get: () => () => { throw new Error('Recognition must never read or write saved drafts'); } });
const highTech = new HighTechService(noPersistence, companyClient, service);
const rejectStatus = (callback, status) => assert.rejects(callback, (e) => e.getStatus?.() === status);

async function verifyRecognition() {
  process.env.AI_API_KEY = 'synthetic-test-key-not-a-secret';
  process.env.AI_IP_VISION_ENABLE = '1';
  const parsed = await pdfParse(new Uint8Array(textPdf()));
  assert.match(parsed.text, /Patent certificate/);
  await rejectStatus(() => service.recognize([]), 400);
  await rejectStatus(() => service.recognize(Array.from({ length: 11 }, () => file())), 400);
  await rejectStatus(() => service.recognize(Array.from({ length: 4 }, () => file(Buffer.alloc(8 * 1024 * 1024)))), 400);
  await rejectStatus(() => highTech.recognizeIpPdfs(2, '101', [file()]), 403);
  await rejectStatus(() => highTech.recognizeIpPdfs(1, '102', [file()]), 403);
  await rejectStatus(() => highTech.recognizeIpPdfs(1, '../101', [file()]), 400);
  assert.equal(calls.length, 0, 'Scope checks must precede AI calls');
  const mixed = await highTech.recognizeIpPdfs(1, '101', [file(Buffer.from('fake'), 'fake.pdf'), file(textPdf(), 'wrong.txt'), file()]);
  assert.equal(mixed.errors.length, 2);
  assert.equal(mixed.total, 1);
  assert.equal(mixed.rows[0].patentType, '实用新型');
  assert.equal(mixed.rows[0].legalStatus, '授权');
  assert.equal(mixed.rows[0].grantDate, '2025-03-02');
  assert.equal(mixed.rows[0].applicationDate, '2024-02-29');
  assert.equal(mixed.rows[0].patentNumber, 'ZL00123456.X');
  assert.equal('sourceFile' in mixed.rows[0], false);
  assert.ok(mixed.errors.every((message) => !message.includes('.pdf')));
  assert.equal(calls[0].messages[1].content.some((item) => item.type === 'image_url'), false, 'Readable PDF uses extracted text');
  const priorTemp = fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('hqx-ip-pdf-'));
  const scanned = await service.recognize([file(pdf())]);
  assert.equal(scanned.total, 1, 'Real Poppler rendering of image-only/blank pages succeeds');
  assert.ok(calls.at(-1).messages[1].content.some((item) => item.type === 'image_url' && item.image_url.url.startsWith('data:image/png;base64,')));
  assert.deepEqual(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('hqx-ip-pdf-')), priorTemp, 'Temporary files are removed');
  answer = { rows: [{ ...example, applicationDate: '2025-02-30', legalStatus: '未知', grantDate: '2025-03', patentType: '未知' }] };
  const uncertain = await service.recognize([file()]);
  for (const key of ['applicationDate', 'grantDate', 'legalStatus', 'patentType']) assert.equal(uncertain.rows[0][key], '');
  assert.ok(uncertain.warnings.length);
  answer = { rows: [{ ...example, patentType: '计算机软件著作权', patentNumber: '2025SR0123456', applicationDate: '' }, example] };
  const multi = await service.recognize([file()]);
  assert.equal(multi.total, 2);
  assert.equal(multi.rows[0].patentType, '软件著作权');
  assert.equal(multi.rows[0].applicationDate, '2024-09-02');
  assert.notEqual(multi.rows[0].id, multi.rows[1].id);
  assert.equal(multi.rows[1].applicationDate, '2024-02-29');
  answer = '```json\n' + JSON.stringify({ rows: [example] }) + '\n```';
  assert.equal((await service.recognize([file()])).total, 1);
  for (const invalid of ['bad-json', 'null', { rows: [] }, { rows: [null, 1, {}, []] }, { rows: Array(201).fill(example) }]) {
    answer = invalid;
    const result = await service.recognize([file()]);
    assert.equal(result.total, 0);
    assert.equal(result.errors.length, 1);
  }
  answer = { rows: [example] };
  const sevenPages = await service.recognize([file(pdf('Patent certificate '.repeat(10), 7))]);
  assert.ok(sevenPages.warnings.some((item) => item.includes('前6页')));
  process.env.AI_IP_VISION_ENABLE = '0';
  const before = calls.length;
  assert.equal((await service.recognize([file(pdf())])).errors.length, 1);
  assert.equal(calls.length, before, 'Disabled vision never sends images');
  process.env.AI_IP_VISION_ENABLE = '1';
  const failedService = new HighTechIpRecognitionService({ chat: async () => { throw new Error('secret-upstream-body'); } });
  const failure = await failedService.recognize([file(), file()]);
  assert.equal(failure.errors.length, 2);
  assert.ok(!JSON.stringify(failure).includes('secret-upstream-body'));
  assert.equal(failedService.activeBatches, 0);
  service.activeBatches = 2;
  await rejectStatus(() => service.recognize([file()]), 503);
  service.activeBatches = 0;
  delete process.env.AI_API_KEY;
  await rejectStatus(() => service.recognize([file()]), 503);
  process.env.AI_API_KEY = 'synthetic-test-key-not-a-secret';
}

async function verifyHttp() {
  const guards = Reflect.getMetadata(GUARDS_METADATA, HighTechController);
  Reflect.defineMetadata(GUARDS_METADATA, [{ canActivate(context) { context.switchToHttp().getRequest().currentUser = { id: 1, portal: 'client' }; return true; } }], HighTechController);
  class TestModule {}
  Module({ controllers: [HighTechController], providers: [{ provide: HighTechService, useValue: highTech }] })(TestModule);
  let app;
  try {
    app = await NestFactory.create(TestModule, { logger: false });
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const upload = (files, companyId = '101') => {
      const form = new FormData();
      files.forEach((item) => form.append('files', new Blob([item.buffer], { type: 'application/pdf' }), item.originalname));
      return fetch(`${base}/client/companies/${companyId}/high-tech-application/ip-summary/recognize-pdfs`, { method: 'POST', body: form });
    };
    const response = await upload([file(), file(Buffer.from('not a PDF'))]);
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.code, 0);
    assert.equal(payload.data.total, 1);
    assert.equal(payload.data.errors.length, 1);
    const fullBatch = await upload(Array.from({ length: 10 }, () => file()));
    assert.equal(fullBatch.status, 201, 'The advertised maximum of 10 PDFs must be accepted');
    assert.equal((await fullBatch.json()).data.total, 10);
    assert.equal((await upload([])).status, 400);
    assert.equal((await upload([file()], '102')).status, 403);
    assert.equal((await upload(Array.from({ length: 11 }, () => file()))).status, 400);
    assert.equal((await upload([file(Buffer.alloc(10 * 1024 * 1024 + 1))])).status, 413);
  } finally {
    if (app) { app.getHttpServer().closeAllConnections(); await app.close(); }
    Reflect.defineMetadata(GUARDS_METADATA, guards, HighTechController);
  }
}

function verifyFrontendAppend() {
  const ts = require('typescript');
  const dir = path.resolve(__dirname, '../../vue-admin/apps/web-client/src/views/client/high-tech-application');
  const load = (name, requireFn) => {
    const source = fs.readFileSync(path.join(dir, `${name}.ts`), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } });
    const module = { exports: {} };
    vm.runInNewContext(compiled.outputText, { module, exports: module.exports, require: requireFn, crypto: webcrypto, console, Date });
    return module.exports;
  };
  const periods = load('research-period', require);
  const model = load('model', (name) => name === './research-period' ? periods : require(name));
  const { prepareRecognizedIpRows: prepare } = load('ip-recognition', (name) => name === './model' ? model : require(name));
  const existing = [{ ...example, id: 'old', number: 'IP01', patentType: '实用新型', legalStatus: '授权', grantDate: '2025-03-02', applicationDate: '2024-02-29' }];
  const preview = [{ ...existing[0], id: 'new', patentNumber: '2025SR0222222', name: '  new name  ', sourceFile: 'sample.pdf' }];
  const before = JSON.stringify({ existing, preview });
  const result = prepare(existing, preview);
  assert.equal(result[0].number, 'IP02');
  assert.equal(result[0].name, 'new name');
  assert.equal(result[0].sourceFile, undefined, 'Preview metadata does not leak into saved drafts');
  assert.equal(JSON.stringify({ existing, preview }), before, 'No mutations before confirmation');
  assert.throws(() => prepare(existing, [{ ...preview[0], patentNumber: '00123456.x' }]), /重复/);
  assert.throws(() => prepare([], [preview[0], { ...preview[0], id: 'other' }]), /重复/);
  assert.throws(() => prepare(existing, [{ ...preview[0], legalStatus: '' }]), /法律状态/);
  assert.throws(() => prepare(Array(200).fill(existing[0]), preview), /200/);
  assert.equal(prepare([], [{ ...preview[0], number: '' }])[0].number, 'IP01');
  assert.notEqual(prepare(existing, [{ ...preview[0], id: 'old' }])[0].id, 'old');
}

async function main() {
  await verifyRecognition();
  await verifyHttp();
  verifyFrontendAppend();
  console.log('IP PDF recognition: text/scan, normalization, partial failure, permissions, multipart limits, no autosave, preview append/duplicates passed');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
