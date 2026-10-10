const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(process.env.HIGH_TECH_BUILD_DIR || path.join(__dirname, '../dist'));
const imported = (name) => require(path.join(root, 'modules/client/high-tech', name));
const { emptyHighTechDraft, normalizeHighTechDraft, SCORE_FIELDS } = imported('high-tech.model');
const { allocationGroups, allocationInput, allocationTiming, existingIp, optimizeAllocation, parseAllocationPeriod, validDate } = imported('high-tech-ip-allocation');
const { solveAllocationFlow } = imported('high-tech-ip-allocation-flow');
const { HighTechIpAllocationService } = imported('high-tech-ip-allocation.service');
const { HighTechService } = imported('high-tech.service');

const project = (id, rdNumber, researchPeriod = '2025-01-01—2025-12-31') => ({ ...emptyHighTechDraft().projects[0], id, rdNumber, researchPeriod, activityName: '', techField: '服务器/客户端操作系统' });
const ip = (id, applicationDate = '2025-06-01', patentType = '软件著作权') => ({ id, number: `IP${id}`, name: `工业控制软件${id}`, patentType, legalStatus: '授权', patentNumber: `SR-${id}`, patentee: '示例公司', applicationDate, grantDate: '2026-01-01' });
const fakeAi = (split = false) => ({ chat: async ({ messages }) => {
  const names = JSON.parse(messages[1].content);
  assert.ok(names.every((entry) => Object.keys(entry).join(',') === 'id,name'), 'Only IP names go to the name-grouping model');
  return { content: JSON.stringify({ groups: (split ? names.map((entry) => [entry.id]) : [names.map((entry) => entry.id)])
    .map((nameIds) => ({ nameIds, reason: split ? '没有名称相近依据，保守单独成组' : '具体技术对象和用途相近' })) }) };
} });
const neverAi = { chat: async () => { throw new Error('First round must not call AI'); } };

function verifyRules() {
  assert.equal(validDate('2025-02-29'), undefined);
  assert.ok(validDate('2024-02-29'));
  const period = parseAllocationPeriod('2025年1月—2025年12月');
  assert.deepEqual(period, { start: Date.parse('2025-01-01'), end: Date.parse('2025-12-31') });
  assert.deepEqual(parseAllocationPeriod('2025-01-01—2025-12-31'), period);
  assert.equal(parseAllocationPeriod('2025-12—2025-01'), undefined);
  for (const [date, expected] of [['2024-12-31', 'manual'], ['2025-01-01', 'manual'], ['2025-01-02', 'within'], ['2025-12-31', 'within'], ['2026-01-01', 'after']]) {
    assert.equal(allocationTiming(date, period), expected);
  }
  const row = project('r1', 'RD01');
  row.ipNumber = 'IPa、IPb';
  assert.equal(existingIp(ip('a'), [row]), true);
  assert.equal(existingIp(ip('b'), [row]), true);
  assert.equal(allocationGroups([row])[0].existingCount, 2);
  assert.ok(allocationGroups([project('blank', 'RD01')])[0].period, 'Blank names retain their dates');
  assert.ok(allocationGroups([row, { ...row, id: 'other', activityName: '不同研发' }])[0].period, 'RD names no longer participate in allocation');
  assert.equal(allocationGroups([row, { ...row, id: 'other', researchPeriod: '2024-01—2024-12' }])[0].period, undefined);
  assert.throws(() => allocationInput({ projects: [row, { ...row }], ipSummary: [] }), /重复/);
  const draft = { ...emptyHighTechDraft(), revision: 0, currentStep: 2, projects: [row] };
  for (const field of SCORE_FIELDS) draft.scores[field.key] = field.max;
  for (const key of ['ipNumber', 'ipName', 'authorizationNumber', 'authorizationDate', 'ipType', 'acquisitionMethod']) row[key] = '';
  for (const key of ['activityName', 'psNumber', 'achievementName', 'techField']) row[key] ||= '核对';
  assert.equal(normalizeHighTechDraft(draft).projects[0].ipNumber, '');
  row.ipName = '部分IP';
  assert.throws(() => normalizeHighTechDraft(draft), /知识产权序号|授权号/);
}

function verifyOptimization() {
  const select = (candidates, groups, rowCount = 2, round = 'spread') => solveAllocationFlow({ candidates, groups, rowCount, round }).map((index) => candidates[index]);
  const groups = [{ id: 'a', existingCount: 0, vacantCount: 1 }, { id: 'b', existingCount: 0, vacantCount: 1 }];
  const both = Array.from({ length: 6 }, (_, i) => groups.map((group) => ({ ipId: String(i), projectId: group.id, timing: 'within' }))).flat();
  assert.equal(select(both, groups).length, 2, 'Round one never places several IPs on one RD');
  const appended = select(both, groups.map((group) => ({ ...group, existingCount: 1 })), 2, 'append');
  assert.equal(appended.filter((item) => item.projectId === 'a').length, 3);
  assert.equal(appended.filter((item) => item.projectId === 'b').length, 3);
  const early = select([{ ipId: 'x', projectId: 'a', timing: 'within' }, { ipId: 'x', projectId: 'b', timing: 'within' }], groups);
  assert.equal(early[0].projectId, 'a');
  const within = select([{ ipId: 'x', projectId: 'a', timing: 'after' }, { ipId: 'x', projectId: 'b', timing: 'within' }], groups);
  assert.equal(within[0].projectId, 'b', 'Time priority precedes table order');
  const global = select([{ ipId: 'flex', projectId: 'b', timing: 'within' }, { ipId: 'flex', projectId: 'a', timing: 'after' }, { ipId: 'fixed', projectId: 'b', timing: 'within' }], groups);
  assert.equal(global.length, 2, 'Residual matching spreads without a greedy dead end');
  assert.equal(global.find((item) => item.ipId === 'flex').projectId, 'a');
  assert.equal(select(both, groups.map((group) => ({ ...group, existingCount: 1 }))).length, 0, 'Existing IPs satisfy first-round coverage');
  assert.equal(select(both, groups.map((group) => ({ ...group, vacantCount: 0 })), 200).length, 0, 'Capacity can leave IPs unassigned');

  // Compare both rounds against exhaustive feasible assignments, including the global row budget.
  let seed = 20261009;
  const random = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  const lexLess = (a, b) => a.some((item, index) => item < b[index] && a.slice(0, index).every((part, j) => part === b[j]));
  for (const round of ['spread', 'append']) for (let trial = 0; trial < 100; trial++) {
    const rds = Array.from({ length: 3 }, (_, i) => ({ id: String(i), existingCount: random(3), vacantCount: random(2) }));
    const candidates = Array.from({ length: 4 }, (_, i) => rds.filter(() => random(3)).map((rd) => ({ ipId: String(i), projectId: rd.id, timing: random(2) ? 'within' : 'after' }))).flat();
    const objective = (picked) => {
      const counts = rds.map((rd) => picked.filter((item) => item.projectId === rd.id).length);
      return [-picked.length, picked.filter((item) => item.timing === 'after').length,
        round === 'append' ? counts.reduce((sum, count, i) => sum + 2 * rds[i].existingCount * count + count ** 2, 0) : 0,
        picked.reduce((sum, item) => sum + Number(item.projectId), 0)];
    };
    let best = objective([]);
    const enumerate = (index, picked) => {
      if (index === 4) {
        const counts = rds.map((rd) => picked.filter((item) => item.projectId === rd.id).length);
        if (round === 'spread' && counts.some((count, i) => count > (rds[i].existingCount ? 0 : 1))) return;
        if (counts.reduce((sum, count, i) => sum + Math.max(0, count - rds[i].vacantCount), 0) > 2) return;
        const value = objective(picked);
        if (lexLess(value, best)) best = value;
        return;
      }
      enumerate(index + 1, picked);
      for (const item of candidates.filter((candidate) => candidate.ipId === String(index))) enumerate(index + 1, [...picked, item]);
    };
    enumerate(0, []);
    assert.deepEqual(objective(select(candidates, rds, 198, round)), best, `${round} global optimum trial ${trial}`);
  }
  const denseGroups = Array.from({ length: 200 }, (_, i) => ({ id: `rd${i}`, existingCount: 0, vacantCount: 1 }));
  const dense = Array.from({ length: 200 }, (_, i) => denseGroups.map((group) => ({ ipId: `ip${i}`, projectId: group.id, timing: 'within' }))).flat();
  const start = performance.now();
  const large = select(dense, denseGroups, 200);
  assert.equal(large.length, 200);
  assert.equal(new Set(large.map((item) => item.projectId)).size, 200);
  assert.ok(performance.now() - start < 15_000, '40,000 candidates stay within the optimizer timeout');
}

async function verifyService() {
  const previous = process.env.AI_API_KEY;
  process.env.AI_API_KEY = 'test-only';
  try {
    const projects = ['a', 'b', 'c', 'd'].map((id, i) => project(id, `RD0${i + 1}`));
    const service = new HighTechIpAllocationService(neverAi);
    const input = { projects, ipSummary: [ip('x'), ip('y')] };
    const before = JSON.stringify(input);
    const result = await service.preview(input);
    assert.equal(JSON.stringify(input), before, 'Preview never writes input data');
    assert.equal(result.strategy, 'spread_then_similar');
    assert.deepEqual(result.assignments.map((item) => item.projectId), ['a', 'b']);
    assert.ok(result.assignments.every((item) => item.round === 'spread'));
    assert.equal(result.nameGroups.length, 0);
    for (const removed of ['weights', 'threshold', 'profiles']) assert.equal(removed in result, false, 'No legacy score payload');
    const renamed = await service.preview({ ...input, projects: projects.map((row) => ({ ...row, activityName: '名称不影响分配', techField: '不同领域' })) });
    assert.deepEqual(renamed.assignments, result.assignments);

    // Reproduce seven IPs and nine blank-name RDs with two branches each; names do not block spreading.
    const periods = ['2023-01-01—2023-08-31', '2023-03-01—2023-10-31', '2023-05-01—2023-12-31',
      '2024-01-01—2024-08-31', '2024-03-01—2024-10-31', '2024-05-01—2024-12-31',
      '2025-01-01—2025-08-31', '2025-03-01—2025-10-31', '2025-05-01—2025-12-31'];
    const dates = ['2024-12-20', '2025-02-11', '2025-02-11', '2025-02-11', '2025-02-12', '2025-03-12', '2025-04-17'];
    const reported = await service.preview({ projects: periods.flatMap((period, i) => [0, 1].map((branch) => project(`r${i}-${branch}`, `RD0${i + 1}`, period))),
      ipSummary: dates.map((date, i) => ip(String(i), date)) });
    assert.equal(reported.assignments.length, 7);
    assert.equal(new Set(reported.assignments.map((item) => item.projectId)).size, 7, 'Seven IPs go to seven RDs rather than clustering');
    assert.equal(Math.max(...reported.distribution.map((item) => item.addedCount)), 1);
    assert.equal(reported.assignments.filter((item) => item.timing === 'within').length, 3);
    assert.deepEqual(reported.distribution.filter((item) => item.addedCount).map((item) => item.rdNumber), ['RD01', 'RD02', 'RD03', 'RD04', 'RD06', 'RD07', 'RD08']);
    const both = { projects: projects.slice(0, 2), ipSummary: [ip('x'), ip('y'), ip('z')] };
    const related = await new HighTechIpAllocationService(fakeAi()).preview(both);
    assert.deepEqual(related.assignments.map((item) => item.round), ['spread', 'spread', 'append']);
    assert.equal(related.assignments[2].projectId, 'a');
    assert.deepEqual(related.assignments[2].similarNames, [ip('x').name]);
    assert.ok(related.nameGroups[0].reason);
    const unrelated = await new HighTechIpAllocationService(fakeAi(true)).preview(both);
    assert.equal(unrelated.assignments.length, 2);
    assert.deepEqual(unrelated.unassigned.map((item) => item.ipId), ['z']);
    assert.match(unrelated.unassigned[0].reason, /没有时间合格且已有相近名称/);
    const existing = { ...projects[0], ipNumber: 'IPold', ipName: ip('old').name, authorizationNumber: 'SR-old' };
    const preserved = await new HighTechIpAllocationService(fakeAi()).preview({ projects: [existing, projects[1]], ipSummary: [ip('old'), ip('new')] });
    assert.deepEqual(preserved.preserved, ['old']);
    assert.equal(preserved.assignments[0].projectId, 'b', 'Empty RDs precede appending to occupied ones');
    const appendToExisting = await new HighTechIpAllocationService(fakeAi()).preview({ projects: [existing], ipSummary: [ip('new')] });
    assert.equal(appendToExisting.assignments[0].round, 'append');
    assert.deepEqual(appendToExisting.assignments[0].similarNames, [existing.ipName]);

    for (const type of ['发明专利', '实用新型', '软件著作权']) {
      const boundary = await new HighTechIpAllocationService(fakeAi()).preview({ projects: [projects[0]], ipSummary: [ip('before', '2024-12-31', type), ip('start', '2025-01-01', type), ip('end', '2025-12-31', type), ip('after', '2026-01-01', type)] });
      assert.deepEqual(boundary.assignments.map(({ ipId, timing }) => [ipId, timing]), [['end', 'within'], ['after', 'after']]);
      assert.deepEqual(boundary.unassigned.map(({ ipId }) => ipId), ['before', 'start']);
      assert.ok(boundary.warnings.some((warning) => warning.includes('IPstart')));
    }
    const conflict = await service.preview({ projects: [projects[0], { ...projects[0], id: 'other', researchPeriod: '2024-01—2024-12' }], ipSummary: [ip('x')] });
    assert.equal(conflict.assignments.length, 0);
    assert.ok(conflict.warnings.some((warning) => warning.includes('不一致')));
    const invalid = await service.preview({ projects, ipSummary: [ip('outside', '2025-06-01', '外观设计'), { ...ip('missing'), grantDate: '' }, ip('dup'), { ...ip('other'), name: ip('dup').name }] });
    assert.equal(invalid.assignments.length, 0);
    assert.equal(invalid.unassigned.length, 4);
    for (const bad of [{ groups: [] }, { groups: [{ nameIds: ['invented'], reason: '不可信' }] }, { groups: [{ nameIds: ['N1', 'N1'], reason: '重复来源' }] }]) {
      const snapshot = JSON.stringify(both);
      await assert.rejects(() => new HighTechIpAllocationService({ chat: async () => ({ content: JSON.stringify(bad) }) }).preview(both), (error) => error.getStatus() === 503);
      assert.equal(JSON.stringify(both), snapshot);
    }
    const manualExcluded = await new HighTechIpAllocationService(fakeAi()).preview({ projects: [existing, project('later', 'RD02', '2026-01-01—2026-12-31')], ipSummary: [ip('new', '2025-01-01')] });
    assert.equal(manualExcluded.assignments.length, 0, 'Name similarity never overrides a forbidden date');
    const limited = await new HighTechIpAllocationService(neverAi).preview({ projects: Array.from({ length: 200 }, (_, i) => ({ ...project(String(i), 'RD01'), ipName: `已有控制${i}` })), ipSummary: [ip('x')] });
    assert.equal(limited.assignments.length, 0);
    assert.match(limited.unassigned[0].reason, /容量/);

    // Cap concurrent previews including both round solvers and the name-model wait.
    let started = 0;
    let release;
    let bothStarted;
    const gate = new Promise((resolve) => { release = resolve; });
    const ready = new Promise((resolve) => { bothStarted = resolve; });
    const held = new HighTechIpAllocationService({ chat: async (request) => {
      if (++started === 2) bothStarted();
      await gate;
      return fakeAi().chat(request);
    } });
    const one = held.preview(both);
    const two = held.preview(both);
    await ready;
    await assert.rejects(() => held.preview(both), (error) => error.getStatus() === 503);
    release();
    await Promise.all([one, two]);
    const access = new HighTechService({}, { getClientCompanies: async () => [{ id: '101', enterpriseProjects: ['国家高新技术企业'] }] }, undefined, undefined, service);
    await assert.rejects(() => access.previewIpAllocation(1, '102', input), (error) => error.getStatus() === 403);
    await assert.rejects(() => access.previewIpAllocation(1, 'bad', input), (error) => error.getStatus() === 400);
    delete process.env.AI_API_KEY;
    assert.equal((await service.preview(input)).assignments.length, 2, 'First-round spreading works without AI configuration');
    const noAi = await service.preview(both);
    assert.equal(noAi.assignments.length, 2);
    assert.equal(noAi.unassigned.length, 1);
    assert.ok(noAi.warnings.some((warning) => warning.includes('尚未配置')));
    assert.deepEqual(await optimizeAllocation([], [], 0, 'spread'), []);
  } finally {
    if (previous === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = previous;
  }
}

async function verifyHttp() {
  const { Module, UnauthorizedException } = require('@nestjs/common');
  const { GUARDS_METADATA } = require('@nestjs/common/constants');
  const { NestFactory } = require('@nestjs/core');
  const { HighTechController } = imported('high-tech.controller');
  const { highTechDraftBodyParser } = imported('high-tech-body-parser');
  const { ResponseInterceptor } = require(path.join(root, 'common/interceptors/response.interceptor'));
  const originalGuards = Reflect.getMetadata(GUARDS_METADATA, HighTechController);
  assert.deepEqual(originalGuards.map((guard) => guard.name), ['AccessTokenGuard', 'PortalGuard']);
  // Mock credential verification only; real controller, company access, input
  // validation, two-round allocation service and optimizer handle the request end to end.
  Reflect.defineMetadata(GUARDS_METADATA, [{ canActivate(context) {
    const request = context.switchToHttp().getRequest();
    if (request.headers.authorization !== 'Bearer allocation-test') throw new UnauthorizedException();
    request.currentUser = { id: 1, portal: 'client' };
    return true;
  } }], HighTechController);
  let writes = 0;
  const repository = { insert: async () => { writes++; }, update: async () => { writes++; }, save: async () => { writes++; } };
  const allocation = new HighTechIpAllocationService(fakeAi());
  const service = new HighTechService(repository, { getClientCompanies: async () => [
    { id: '101', enterpriseProjects: ['国家高新技术企业'] }, { id: '103', enterpriseProjects: [] },
  ] }, undefined, undefined, allocation);
  class VerificationModule {}
  Module({ controllers: [HighTechController], providers: [{ provide: HighTechService, useValue: service }] })(VerificationModule);
  const previous = process.env.AI_API_KEY;
  process.env.AI_API_KEY = 'test-only';
  let app;
  try {
    app = await NestFactory.create(VerificationModule, { logger: false });
    app.use(highTechDraftBodyParser);
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const send = (body, company = '101', authorized = true) => fetch(`${base}/client/companies/${company}/high-tech-application/ip-allocation/preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: 'Bearer allocation-test' } : {}) }, body: JSON.stringify(body),
    });
    const input = { projects: [project('rd1', 'RD01', '2025-01-01—2025-12-31')], ipSummary: [ip('a', '2025-02-01')] };
    assert.equal((await send(input, '101', false)).status, 401);
    assert.equal((await send(input, '102')).status, 403);
    assert.equal((await send(input, '103')).status, 403);
    assert.equal((await send(input, 'bad')).status, 400);
    assert.equal((await send({ ...input, ipSummary: [input.ipSummary[0], input.ipSummary[0]] })).status, 400);
    const response = await send(input);
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.code, 0);
    assert.equal(result.data.assignments[0].ipId, 'a');
    const large = { ...input, ipSummary: Array.from({ length: 200 }, (_, i) => ({ ...ip(String(i), '2025-02-01'), name: `${'工'.repeat(400)}${i}` })) };
    assert.ok(Buffer.byteLength(JSON.stringify(large)) > 100 * 1024);
    const bigResponse = await send(large);
    assert.equal(bigResponse.status, 201, 'Preview receives the scoped large-body parser');
    const bigResult = await bigResponse.json();
    assert.equal(bigResult.data.strategy, 'spread_then_similar');
    assert.equal(bigResult.data.nameGroups.length, 1);
    assert.equal(bigResult.data.assignments.filter((item) => item.round === 'spread').length, 1);
    assert.equal(bigResult.data.assignments.filter((item) => item.round === 'append').length, 199);
    assert.equal(bigResult.data.assignments.length, 200, 'Reuse the existing vacant branch before adding 199 rows');
    assert.equal(writes, 0, 'Preview never persists');
  } finally {
    if (app) await app.close();
    Reflect.defineMetadata(GUARDS_METADATA, originalGuards, HighTechController);
    if (previous === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = previous;
  }
}


(async () => { verifyRules(); verifyOptimization(); await verifyService(); await verifyHttp(); console.log('High-tech two-round IP allocation verification passed'); })()
  .catch((error) => { console.error(error); process.exitCode = 1; });
