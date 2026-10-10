const assert = require('node:assert/strict');
const path = require('node:path');
const { Module } = require('@nestjs/common');
const { GUARDS_METADATA } = require('@nestjs/common/constants');
const { NestFactory } = require('@nestjs/core');
const dist = process.env.HIGH_TECH_TEST_DIST || path.join(__dirname, '../dist');
const { HIGH_TECH_FULL_FIELD_CATALOG: groups } = require(path.join(dist, 'modules/client/high-tech/high-tech-full-field-catalog'));
const { HighTechFieldRecommendationService, HIGH_TECH_SEARCHABLE_FIELDS: fields } = require(path.join(dist, 'modules/client/high-tech/high-tech-field-recommendation.service'));
const { HighTechService } = require(path.join(dist, 'modules/client/high-tech/high-tech.service'));
const { HighTechController } = require(path.join(dist, 'modules/client/high-tech/high-tech.controller'));
const { highTechDraftBodyParser } = require(path.join(dist, 'modules/client/high-tech/high-tech-body-parser'));
const { ResponseInterceptor } = require(path.join(dist, 'common/interceptors/response.interceptor'));
const { HttpExceptionFilter } = require(path.join(dist, 'common/filters/http-exception.filter'));
const rejects = (fn, status) => assert.rejects(fn, (error) => error.getStatus?.() === status);

async function verifyHttp(service, prepareResponses, bi) {
  const guards = Reflect.getMetadata(GUARDS_METADATA, HighTechController);
  // Mock authentication only; retain real routing, authorization and body parsing.
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
    const endpoint = (company) => `${base}/client/companies/${company}/high-tech-application/tech-fields`;
    const recommend = (company, patentNames) => fetch(`${endpoint(company)}/recommend`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patentNames }),
    });
    const catalog = await fetch(endpoint('101'));
    assert.equal(catalog.status, 200);
    assert.deepEqual((await catalog.json()).data.fields, fields);
    assert.equal((await fetch(endpoint('102'))).status, 403);
    assert.equal((await recommend('102', ['BI软件'])).status, 403);
    assert.equal((await recommend('101', [])).status, 400);
    const names = Array.from({ length: 200 }, (_, index) => `${index}${'专'.repeat(508)}`);
    assert.ok(Buffer.byteLength(JSON.stringify({ patentNames: names })) > 100 * 1024);
    prepareResponses();
    const response = await recommend('101', names);
    assert.equal(response.status, 201, 'Valid Chinese patent lists exceed Nest default body limit');
    assert.deepEqual((await response.json()).data, { fields: [bi] });
  } finally {
    if (app) {
      app.getHttpServer().closeAllConnections();
      await app.close();
    }
    Reflect.defineMetadata(GUARDS_METADATA, guards, HighTechController);
  }
}

async function main() {
  assert.equal(groups.length, 254);
  assert.equal(fields.length, 1070);
  assert.equal(new Set(groups.map((group) => group.path[0])).size, 8);
  assert.equal(new Set(groups.map((group) => group.path.slice(0, 2).join('/'))).size, 49);
  assert.equal(new Set(fields.map((field) => field.id)).size, fields.length);
  assert.ok(fields.every((field) => field.label.length <= 512 && !field.label.includes('*')));
  for (const group of groups) {
    assert.equal(group.path.length, 3);
    assert.match(group.path[1], /^（[一二三四五六七八九十]+）/);
    assert.match(group.path[2], /^\d+\s*[.．、]/);
    assert.ok(group.fields.every((field) => field.label.startsWith(group.path.join(' / ') + ' / ')));
  }
  const bi = fields.find((field) => field.label === '一、电子信息 / （一）软件 / 9. 企业管理软件 / 数据分析与决策支持的商业智能（BI）软件');
  assert.ok(bi);
  const biGroup = groups.find((group) => group.fields.includes(bi));
  const calls = [];
  let responses = [{ ids: [biGroup.id, biGroup.id] }, { ids: [bi.id, bi.id] }];
  const ai = { chat: async (request) => {
    calls.push(request);
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return { content: typeof response === 'string' ? response : JSON.stringify(response) };
  } };
  const service = new HighTechFieldRecommendationService(ai);
  const oldKey = process.env.AI_API_KEY;
  process.env.AI_API_KEY = 'test-only';
  try {
    for (const input of [null, {}, { patentNames: [] }, { patentNames: [' '] }, { patentNames: [1] }, { patentNames: ['a'.repeat(513)] }, { patentNames: Array(201).fill('a') }]) {
      await rejects(() => service.recommend(input), 400);
    }
    assert.equal(calls.length, 0);
    assert.deepEqual(await service.recommend({ patentNames: [' BI软件 ', 'BI软件', ''] }), { fields: [bi] });
    assert.deepEqual(JSON.parse(calls[0].messages[1].content).patentNames, ['BI软件']);
    assert.equal(JSON.parse(calls[0].messages[1].content).candidates.length, 254);
    assert.ok(JSON.parse(calls[1].messages[1].content).candidates.every((field) => biGroup.fields.some((leaf) => leaf.id === field.id)));
    for (const response of ['not JSON', { ids: ['invented'] }, { ids: [] }, { ids: Array(9).fill(biGroup.id) }, new Error('provider failed')]) {
      responses = [response];
      await rejects(() => service.recommend({ patentNames: ['BI软件'] }), 503);
    }
    for (const response of [{ ids: ['invented'] }, { ids: [] }, { ids: Array(6).fill(bi.id) }]) {
      responses = [{ ids: [biGroup.id] }, response];
      await rejects(() => service.recommend({ patentNames: ['BI软件'] }), 503);
    }
    delete process.env.AI_API_KEY;
    await rejects(() => service.recommend({ patentNames: ['BI软件'] }), 503);
    const repository = { save: () => assert.fail('Recommendation must not persist a draft') };
    const client = { getClientCompanies: async (user) => user === 1 ? [
      { id: '101', enterpriseProjects: ['国家高新技术企业'] },
      { id: '102', enterpriseProjects: ['专精特新企业'] },
    ] : [] };
    const highTech = new HighTechService(repository, client, undefined, service);
    assert.deepEqual(await highTech.fieldCatalog(1, '101'), { fields });
    for (const method of ['fieldCatalog', 'recommendFields']) {
      await rejects(() => highTech[method](2, '101', { patentNames: ['BI软件'] }), 403);
      await rejects(() => highTech[method](1, '102', { patentNames: ['BI软件'] }), 403);
      await rejects(() => highTech[method](1, '../101', {}), 400);
    }
    process.env.AI_API_KEY = 'test-only';
    responses = [{ ids: [biGroup.id] }, { ids: [bi.id] }];
    assert.deepEqual(await highTech.recommendFields(1, '101', { patentNames: ['BI软件'] }), { fields: [bi] });
    await verifyHttp(highTech, () => { responses = [{ ids: [biGroup.id] }, { ids: [bi.id] }]; }, bi);
  } finally {
    if (oldKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = oldKey;
  }
  console.log('High-tech field catalog, recommendation validation, company access and HTTP checks passed');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
