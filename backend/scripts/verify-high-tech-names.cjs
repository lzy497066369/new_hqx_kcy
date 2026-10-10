const assert = require('node:assert/strict');
const { Module } = require('@nestjs/common');
const { GUARDS_METADATA } = require('@nestjs/common/constants');
const { NestFactory } = require('@nestjs/core');
const { HighTechNameGenerationService } = require('../dist/modules/client/high-tech/high-tech-name-generation.service');
const { nameSources, validateNameAnalysis, validateNamePlan, normalizeNameGeneration } = require('../dist/modules/client/high-tech/high-tech-name-generation');
const { emptyHighTechDraft, normalizeHighTechDraft, PROJECT_FIELDS } = require('../dist/modules/client/high-tech/high-tech.model');
const { HighTechService } = require('../dist/modules/client/high-tech/high-tech.service');
const { HighTechController } = require('../dist/modules/client/high-tech/high-tech.controller');
const { highTechDraftBodyParser } = require('../dist/modules/client/high-tech/high-tech-body-parser');
const { ResponseInterceptor } = require('../dist/common/interceptors/response.interceptor');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const { allocationGroups, allocationTiming } = require('../dist/modules/client/high-tech/high-tech-ip-allocation');

function row(id, rdNumber, ipName = '') {
  return { ...Object.fromEntries(PROJECT_FIELDS.map(({ key }) => [key, key === 'year' ? 2025 : ''])),
    id, rdNumber, ipName, ipType: ipName ? '实用新型' : '', authorizationNumber: ipName ? `ZL${id}` : '',
    authorizationDate: ipName ? '2025-01-01' : '', activityName: '原研发名称', achievementName: '原成果名称',
    psNumber: 'PS01', researchPeriod: '2024-01 至 2025-12' };
}
function fixture(projects) {
  const { sources, groups } = nameSources(projects);
  const analysis = {
    analyses: sources.map((source) => ({ ipId: source.id, technicalObject: '检测对象', coreFunction: '监测',
      technicalProblem: '推断，待确认', technicalSolution: '', applicationScenario: '', technicalDirection: '检测', keywords: ['检测'], confidence: 'low' })),
    themes: sources.length ? [{ id: 'T01', name: '监测技术', ipIds: sources.map((source) => source.id), reason: '名称体现共同监测功能' }] : [],
  };
  const rds = groups.map((group, index) => ({ id: group.id, name: `检测方向${index + 1}技术的研发`,
    ipIds: group.ipIds, themeIds: group.ipIds.length ? ['T01'] : [],
    referenceRdIds: group.ipIds.length ? [] : [groups.find((other) => other.id !== group.id && (other.ipIds.length || other.existingName))?.id].filter(Boolean),
    reason: group.ipIds.length ? `检测对象${index + 1}的独立研发方向` : '参考其他RD的监测方向，研究不同检测环节' }));
  const achievements = rds.map((rd, index) => ({ id: `A${index}`, name: `检测能力${index + 1}技术`, rdId: rd.id, ipIds: rd.ipIds, reason: '检测功能的技术产出' }));
  const products = [{ id: 'P01', name: '综合检测产品', achievementIds: achievements.map((item) => item.id), reason: '全部研发方向和检测能力共同支撑设备功能' }];
  const mappings = projects.map((project) => {
    const group = groups.find((group) => group.rowIds.includes(project.id));
    const achievement = achievements.find((item) => item.rdId === group.id);
    return { projectId: project.id, achievementId: achievement.id, productId: 'P01' };
  });
  return { analysis, plan: { rds, achievements, products, mappings } };
}
const copy = (value) => structuredClone(value);
const status = (code) => (error) => error.getStatus?.() === code;

function stageAnswers(projects, analysis, plan) {
  const answers = [];
  if (analysis.analyses.length) answers.push(analysis);
  for (const hasIp of [true, false]) {
    const rds = plan.rds.filter((rd) => Boolean(rd.ipIds.length) === hasIp);
    if (!rds.length) continue;
    const ids = new Set(rds.map((rd) => rd.id));
    const achievements = plan.achievements.filter((achievement) => ids.has(achievement.rdId));
    const achievementIds = new Set(achievements.map((achievement) => achievement.id));
    answers.push({ achievements, mappings: plan.mappings.filter((mapping) => achievementIds.has(mapping.achievementId)) });
  }
  answers.push({ rds: plan.rds }, { products: plan.products }, { accepted: true, issues: [] });
  return answers;
}

async function verifyHttp(service, projects, result) {
  const guards = Reflect.getMetadata(GUARDS_METADATA, HighTechController);
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
    const post = (company, body) => fetch(`${base}/client/companies/${company}/high-tech-application/names/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal((await post('102', { projects })).status, 403);
    const response = await post('101', { projects });
    assert.equal(response.status, 201);
    assert.deepEqual((await response.json()).data, result);
    const large = Array.from({ length: 200 }, (_, index) => ({ ...projects[0], id: `large${index}`, ipName: '专'.repeat(512) }));
    assert.ok(Buffer.byteLength(JSON.stringify({ projects: large })) > 100 * 1024);
    assert.equal((await post('101', { projects: large })).status, 201, 'Name generation uses the scoped large-body parser');
  } finally {
    if (app) {
      app.getHttpServer().closeAllConnections();
      await app.close();
    }
    Reflect.defineMetadata(GUARDS_METADATA, guards, HighTechController);
  }
}

async function main() {
  process.env.AI_API_KEY = 'synthetic-test-key';
  const projects = Array.from({ length: 9 }, (_, index) => row(`r${index}`, `RD${index + 1}`, index === 0 ? '一种温度检测装置' : ''));
  const { analysis, plan } = fixture(projects);
  const original = copy(projects);
  const calls = [];
  const answers = stageAnswers(projects, analysis, plan);
  const generator = new HighTechNameGenerationService({ chat: async (input) => {
    calls.push(input);
    return { content: JSON.stringify(answers.shift()) };
  } });
  const result = await generator.generate({ projects });
  assert.deepEqual(projects, original, 'Generation must not mutate the input');
  assert.equal(result.rds.length, 9);
  assert.equal(result.rds.filter((rd) => rd.referenceRdIds.length).length, 8);
  assert.equal(result.achievements.length, 9);
  assert.equal(result.version, 3);
  assert.equal(result.status, 'generated');
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].achievementIds.length, 9);
  assert.ok(result.mappings.every((mapping) => mapping.productId === 'P01'));
  assert.equal(calls.length, 6);
  assert.equal(calls[0].responseFormat, 'json_object');
  assert.match(calls[2].messages[0].content, /无IP项目/);
  assert.match(calls[3].messages[0].content, /成果已经生成/);
  assert.match(calls[4].messages[0].content, /不要强制全表共用/);
  assert.match(calls[5].messages[0].content, /独立校验/);
  assert.equal(JSON.parse(calls[1].messages[1].content).groups[0].existingName, undefined, 'Achievements must not be derived from old RD names');
  assert.deepEqual(JSON.parse(calls[3].messages[1].content).achievements, plan.achievements, 'RD naming receives already generated achievements');
  assert.deepEqual(normalizeNameGeneration(result, projects), result);
  const draft = { ...emptyHighTechDraft(), revision: 0, projects, nameGeneration: result };
  assert.deepEqual(normalizeHighTechDraft(draft).nameGeneration, result);
  const renamed = copy(draft);
  renamed.projects[0].activityName = '企业手工修改的名称';
  renamed.projects[0].psName = '企业确认产品名称';
  assert.equal(normalizeHighTechDraft(renamed).nameGeneration.mappings[0].productId, 'P01');
  assert.equal(normalizeHighTechDraft(renamed).projects[0].psName, '企业确认产品名称');
  assert.equal(normalizeHighTechDraft({ ...emptyHighTechDraft(), revision: 0 }).nameGeneration, undefined);
  const legacy = { ...draft, nameGeneration: { version: 1 } };
  assert.equal(normalizeHighTechDraft(legacy).nameGeneration, undefined);
  assert.deepEqual(normalizeHighTechDraft(legacy).projects, normalizeHighTechDraft({ ...draft, nameGeneration: undefined }).projects);
  const previous = copy(result);
  previous.version = 2;
  previous.rds.forEach((rd) => { rd.name = rd.name.replace('的研发', '研发'); });
  previous.products[0].name = '综合检测设备';
  assert.deepEqual(normalizeNameGeneration(previous, projects), previous);
  assert.throws(() => normalizeNameGeneration({ ...result, version: '3' }, projects));
  assert.equal(PROJECT_FIELDS.length, 15);
  assert.equal(allocationTiming('2025-01-01', allocationGroups(projects)[0].period), 'within');

  const multi = [row('one', 'RD01', '一种温度检测装置'), row('two', 'RD01', '一种温度监测设备')];
  const shared = fixture(multi);
  assert.equal(validateNameAnalysis(shared.analysis, multi).themes.length, 1);
  assert.deepEqual(validateNamePlan(shared.plan, shared.analysis, multi).achievements[0].ipIds, ['one', 'two']);
  assert.equal(validateNamePlan(shared.plan, shared.analysis, multi).mappings[0].achievementId, shared.plan.mappings[1].achievementId);
  const incomplete = copy(shared.plan); incomplete.rds[0].ipIds.pop();
  assert.throws(() => validateNamePlan(incomplete, shared.analysis, multi), /全部IP/);
  const multiAnswers = stageAnswers(multi, shared.analysis, shared.plan);
  const multiCalls = [];
  await new HighTechNameGenerationService({ chat: async (input) => { multiCalls.push(input); return { content: JSON.stringify(multiAnswers.shift()) }; } }).generate({ projects: multi });
  assert.deepEqual(JSON.parse(multiCalls[1].messages[1].content).groups[0].ipIds, ['one', 'two']);
  const separate = [row('one', 'RD01', '一种温度检测装置'), row('two', 'RD02', '一种数据加密方法')];
  const separated = fixture(separate);
  separated.analysis.themes = [
    { id: 'T01', name: '温度监测', ipIds: ['one'], reason: '检测温度' },
    { id: 'T02', name: '数据加密', ipIds: ['two'], reason: '保护数据' },
  ];
  separated.plan.rds[1].themeIds = ['T02'];
  assert.equal(validateNameAnalysis(separated.analysis, separate).themes.length, 2);
  assert.equal(validateNamePlan(separated.plan, separated.analysis, separate).rds.length, 2);
  const repeated = [row('one', 'RD01', '温度采集与报警装置'), { ...row('two', 'RD02', '温度采集与报警装置'), authorizationNumber: 'ZLone' }];
  const reused = fixture(repeated);
  assert.equal(nameSources(repeated).sources.length, 1);
  assert.deepEqual(validateNamePlan(reused.plan, reused.analysis, repeated).rds.map((rd) => rd.ipIds), [['one'], ['one']]);

  for (const mutate of [
    (value) => { value.rds.pop(); },
    (value) => { value.rds[0].ipIds = ['unknown']; },
    (value) => { value.rds[1].referenceRdIds = []; },
    (value) => { value.rds[1].referenceRdIds = [value.rds[1].id]; },
    (value) => { value.rds[0].referenceRdIds = [value.rds[1].id]; },
    (value) => { value.rds[1].name = '待补充研发资料'; },
    (value) => { value.rds[0].name = '检测技术研发'; },
    (value) => { value.achievements[0].name = '检测装置'; },
    (value) => { value.products[0].name = '检测设备'; },
    (value) => { value.achievements[0].name = value.rds[0].name; },
    (value) => { value.achievements[0].name = projects[0].ipName; },
    (value) => { value.products[0].name = value.achievements[0].name; },
    (value) => { value.products[0].achievementIds.pop(); },
    (value) => { value.mappings[0].productId = 'P02'; },
    (value) => { value.mappings[0].achievementId = null; value.mappings[0].productId = null; },
    (value) => { value.mappings[0].projectId = 'unknown'; },
  ]) {
    const invalid = copy(plan); mutate(invalid);
    assert.throws(() => validateNamePlan(invalid, analysis, projects));
  }
  const conflict = copy(separated.plan);
  conflict.products.push({ ...conflict.products[0], id: 'P02', name: '加密服务', achievementIds: ['A1'] });
  conflict.mappings[1].productId = 'P02';
  assert.throws(() => validateNamePlan(conflict, separated.analysis, separate), /不重复归并/);
  conflict.products[0].achievementIds = ['A0'];
  assert.equal(validateNamePlan(conflict, separated.analysis, separate).products.length, 2);
  separate[1].psNumber = 'PS02';
  assert.equal(validateNamePlan(conflict, separated.analysis, separate).products.length, 2);
  const separateAnswers = stageAnswers(separate, separated.analysis, conflict);
  const separateResult = await new HighTechNameGenerationService({ chat: async () => ({ content: JSON.stringify(separateAnswers.shift()) }) }).generate({ projects: separate });
  assert.equal(separateResult.products.length, 2);
  assert.equal(separateResult.mappings[1].productId, 'P02');
  assert.equal(validateNamePlan(separated.plan, separated.analysis, separate).products.length, 1);
  const invalidAnalysis = copy(analysis); invalidAnalysis.analyses[0].ipId = 'invalid';
  assert.throws(() => validateNameAnalysis(invalidAnalysis, projects));
  delete invalidAnalysis.analyses[0].coreFunction;
  assert.throws(() => validateNameAnalysis(invalidAnalysis, projects));

  let retryCalls = 0;
  const retryAnswers = ['not-json', ...stageAnswers(projects, analysis, plan).map((answer) => JSON.stringify(answer))];
  await new HighTechNameGenerationService({ chat: async () => { retryCalls++; return { content: retryAnswers.shift() }; } }).generate({ projects });
  assert.equal(retryCalls, 7);
  const fail = new HighTechNameGenerationService({ chat: async () => { retryCalls++; return { content: 'not-json' }; } });
  retryCalls = 0;
  await assert.rejects(() => fail.generate({ projects }), status(503));
  assert.equal(retryCalls, 2, 'Retries are bounded');
  const auditAnswers = stageAnswers(projects, analysis, plan).slice(0, -1).concat([{ accepted: false, issues: ['产品归并缺少依据'] }, { accepted: false, issues: ['产品归并缺少依据'] }]);
  await assert.rejects(() => new HighTechNameGenerationService({ chat: async () => ({ content: JSON.stringify(auditAnswers.shift()) }) }).generate({ projects }), /产品归并缺少依据/);
  await assert.rejects(() => new HighTechNameGenerationService({ chat: async () => { throw new Error('private-upstream-secret'); } }).generate({ projects }), (error) => !error.message.includes('private-upstream-secret') && error.getStatus() === 503);
  assert.deepEqual(projects, original);
  const fallback = [row('fallback1', 'RD01'), row('fallback2', 'RD02')];
  fallback[1].activityName = '检测分析技术研发';
  const fallbackFixture = fixture(fallback);
  const fallbackAnswers = stageAnswers(fallback, fallbackFixture.analysis, fallbackFixture.plan);
  let fallbackCalls = 0;
  const fallbackResult = await new HighTechNameGenerationService({ chat: async () => { fallbackCalls++; return { content: JSON.stringify(fallbackAnswers.shift()) }; } }).generate({ projects: fallback });
  assert.equal(fallbackCalls, 4, 'No IP analysis or direct-IP stage for existing-name fallback');
  assert.equal(fallbackResult.rds.length, 2);
  assert.deepEqual(fallbackResult.rds[1].referenceRdIds, ['fallback1']);
  assert.deepEqual(fallbackResult.achievements[1].ipIds, []);
  let blankCalls = 0;
  await assert.rejects(() => new HighTechNameGenerationService({ chat: async () => { blankCalls++; } }).generate({ projects: [row('b1', 'RD01'), row('b2', 'RD02')].map((item) => ({ ...item, activityName: '' })) }), status(400));
  assert.equal(blankCalls, 0);
  await assert.rejects(() => generator.generate({ projects: [row('blank', 'RD01')] }), status(400));
  delete process.env.AI_API_KEY;
  await assert.rejects(() => generator.generate({ projects }), status(503));
  process.env.AI_API_KEY = 'synthetic-test-key';
  let storedDraft;
  const repository = {
    insert: async (entity) => { storedDraft = copy(entity); },
    findOne: async () => storedDraft,
  };
  const highTech = new HighTechService(repository, { getClientCompanies: async (id) => id === 1 ? [
    { id: '101', enterpriseProjects: ['国家高新技术企业'] }, { id: '102', enterpriseProjects: ['其他项目'] },
  ] : [] }, undefined, undefined, undefined, { generate: async () => result });
  assert.deepEqual(await highTech.generateNames(1, '101', { projects }), result);
  await assert.rejects(() => highTech.generateNames(2, '101', { projects }), status(403));
  await assert.rejects(() => highTech.generateNames(1, '102', { projects }), status(403));
  await assert.rejects(() => highTech.generateNames(1, '../101', { projects }), status(400));
  const multiDraft = { ...emptyHighTechDraft(), revision: 0, projects: separate, nameGeneration: separateResult };
  const saved = await highTech.save(1, '101', multiDraft);
  const loaded = await highTech.get(1, '101');
  assert.equal(loaded.nameGeneration.version, 3);
  assert.deepEqual(loaded.nameGeneration, separateResult);
  assert.deepEqual(loaded.projects, saved.projects);
  assert.equal(loaded.nameGeneration.products.length, 2);
  storedDraft.draftJson = JSON.stringify({ ...draft, nameGeneration: previous });
  assert.deepEqual((await highTech.get(1, '101')).nameGeneration, previous, 'Legacy v2 metadata remains readable');
  await verifyHttp(highTech, projects, result);
  console.log('High-tech names: structured stages, mappings, retries, preservation, compatibility, company scope and HTTP routing passed.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
