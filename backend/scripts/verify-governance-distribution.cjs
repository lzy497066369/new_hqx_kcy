const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { ClientGovernanceService } = require('../dist/modules/client-governance/governance.service');
const { ClientService } = require('../dist/modules/client/client.service');
const { EnterpriseProfileService } = require('../dist/modules/enterprise/profile/profile.service');
const { AuthService } = require('../dist/modules/auth/auth.service');
const { AccessTokenGuard } = require('../dist/common/guards/access-token.guard');
const { MemorySessionStore } = require('../dist/infrastructure/cache/memory-session.store');
const { CreateGovernanceEnterpriseDto, DistributeEnterpriseDto } = require('../dist/modules/client-governance/dto');
const { ENTERPRISE_PROJECTS } = require('../dist/common/constants/enterprise-projects');
const { resolveAuthRuntimeConfig } = require('../dist/modules/auth/auth-runtime.config');
const { harness, overall, retired: region, enterprise, rejected } = require('./helpers/client-governance-harness.cjs');
async function main() {
  const input = { name: '测试企业', regionId: '10', salesOwner: '销售甲', enterpriseProjects: [ENTERPRISE_PROJECTS[0]], preDeclarationYear: 2027 };
  assert.equal((await validate(plainToInstance(CreateGovernanceEnterpriseDto, input))).length, 0);
  for (const changes of [{ name: ' ' }, { regionId: '0' }, { regionId: 'other' }, { salesOwner: ' ' }, { salesOwner: '甲'.repeat(65) }]) {
    assert.ok((await validate(plainToInstance(CreateGovernanceEnterpriseDto, { ...input, ...changes }))).length);
  }
  assert.ok((await validate(plainToInstance(DistributeEnterpriseDto, { projectUserId: 'oops' }))).length);
  for (const enterpriseProjects of [ ENTERPRISE_PROJECTS.slice(0, 2), [...ENTERPRISE_PROJECTS]]) {
    assert.equal((await validate(plainToInstance(CreateGovernanceEnterpriseDto, { ...input, enterpriseProjects }))).length, 0);
  }
  const invalidProjects = [undefined, null, [], '国家高新技术企业', ['其他项目'], [42], [ENTERPRISE_PROJECTS[0], ENTERPRISE_PROJECTS[0]], [...ENTERPRISE_PROJECTS, '其他项目']];
  for (const enterpriseProjects of invalidProjects) {
    assert.ok((await validate(plainToInstance(CreateGovernanceEnterpriseDto, { ...input, enterpriseProjects }))).length, 'Invalid project selection must be rejected');
  }
  const h = harness();
  for (const enterpriseProjects of invalidProjects) {
    await rejected(() => h.service.createEnterprise(overall, { ...input, enterpriseProjects }), 400);
  }
  const first = await h.service.createEnterprise(overall, { ...input, enterpriseProjects: [...ENTERPRISE_PROJECTS] });
  assert.deepEqual(first.enterpriseProjects, ENTERPRISE_PROJECTS);
  const second = await h.service.createEnterprise(overall, { ...input, name: '测试企业二' });
  const outside = await h.service.createEnterprise(overall, { ...input, name: '区域B企业', regionId: '11' });
  assert.deepEqual(second.enterpriseProjects, input.enterpriseProjects, 'New archives require at least one project');
  assert.equal(second.preDeclarationYear, 2027);
  for (const preDeclarationYear of [undefined, null, '', '2027', 1999, 2101, 2027.5]) {
    assert.ok((await validate(plainToInstance(CreateGovernanceEnterpriseDto, { ...input, preDeclarationYear }))).length);
    await rejected(() => h.service.createEnterprise(overall, { ...input, preDeclarationYear }), 400);
  }
  assert.deepEqual(h.state().Enterprise[0].enterpriseProjects, ENTERPRISE_PROJECTS);
  assert.equal(h.state().Enterprise[0].creditCode, null);
  assert.equal(h.state().EnterpriseTeacher.length, 0, 'Creation must not assign');
  assert.equal((await h.service.overview(overall)).enterprises.length, 3);
  await rejected(() => h.service.overview(region), 403);
  assert.equal((await h.service.overview(overall)).projectAccounts.length, 3, 'Global leaders need assignee choices');
  const detail = await h.service.enterpriseDetail(overall, first.id);
  assert.equal(detail.name, input.name);
  assert.equal(detail.regionName, '区域A');
  assert.deepEqual(detail.enterpriseProjects, ENTERPRISE_PROJECTS);
  assert.equal(detail.contactPhone, '');
  assert.equal('password' in detail, false, 'Archive details must never include account credentials');
  await rejected(() => h.service.enterpriseDetail(region, first.id), 403);
  assert.equal((await h.service.enterpriseDetail(overall, outside.id)).id, outside.id);
  await rejected(() => h.service.enterpriseDetail(region, outside.id), 403);
  await rejected(() => h.service.enterpriseDetail(enterprise, first.id), 403);
  await rejected(() => h.service.enterpriseDetail({ ...overall, roles: ['global_leader', 'region_leader'] }, first.id), 403);
  await rejected(() => h.service.enterpriseDetail(overall, '99999999'), 404);
  h.state().Region[1].status = 0;
  assert.equal((await h.service.enterpriseDetail(overall, outside.id)).id, outside.id, 'Disabled geography must not hide an existing archive');
  h.state().Region[1].status = 1;
  assert.equal((await h.client.listAccessibleCompanies(3)).length, 0);
  await rejected(() => h.service.createEnterprise(region, { ...input, regionId: '11' }), 403);
  await rejected(() => h.service.createEnterprise(enterprise, input), 403);
  await rejected(() => h.service.createEnterprise(overall, input), 409);
  await rejected(() => h.service.assignEnterprises(region, '5', [first.id]), 403);
  await rejected(() => h.service.assignEnterprises(enterprise, '3', [first.id]), 403);
  await rejected(() => h.service.assignEnterprises(overall, '3', ['9999']), 403);
  await rejected(() => h.service.assignEnterprises(overall, '3', []), 400);
  // Invalid second item rolls back the entire batch, not just its own write.
  await rejected(() => h.service.assignEnterprises(overall, '3', [first.id, '9999']), 403);
  assert.equal(h.state().EnterpriseTeacher.length, 0);
  h.state().User[0].status = 0;
  await rejected(() => h.service.assignEnterprises(overall, '3', [first.id]), 403);
  h.state().User[0].status = 1;
  h.state().UserApp[0].status = 0;
  await rejected(() => h.service.assignEnterprises(overall, '3', [first.id]), 403);
  h.state().UserApp[0].status = 1;
  h.state().Role[0].code = 'region_leader';
  await rejected(() => h.service.assignEnterprises(overall, '3', [first.id]), 403);
  h.state().Role[0].code = 'project_teacher';
  h.fail('EnterpriseTeacher');
  await assert.rejects(() => h.service.assignEnterprises(overall, '3', [first.id]), /Injected/);
  assert.equal(h.state().EnterpriseTeacher.length, 0);
  h.fail('');
  await h.service.assignEnterprises(overall, '3', [first.id]);
  await h.service.assignEnterprises(overall, '3', [second.id]);
  await h.service.assignEnterprises(overall, '3', [first.id]);
  assert.equal(h.state().EnterpriseTeacher.length, 2, 'Retry is idempotent');
  const assigned = await h.client.listAccessibleCompanies(3);
  assert.deepEqual(assigned.map((item) => item.enterprise.id).sort(), [first.id, second.id].sort(), 'Recipient sees both old and new assignments');
  const received = h.client.toClientCompany(assigned.find((item) => item.enterprise.id === first.id), first.id);
  assert.equal(received.name, input.name);
  assert.equal(received.salesOwner, input.salesOwner);
  assert.deepEqual(received.enterpriseProjects, ENTERPRISE_PROJECTS, 'Distribution preserves every selected project');
  const legacy = assigned.find((item) => item.enterprise.id === second.id);
  legacy.enterprise.enterpriseProjects = null;
  legacy.enterprise.salesOwner = null;
  const legacyReceived = h.client.toClientCompany(legacy, first.id);
  assert.deepEqual(legacyReceived.enterpriseProjects, []);
  assert.equal(legacyReceived.salesOwner, '');
  assert.equal((await h.client.listAccessibleCompanies(4)).length, 0, 'Another account cannot see them');
  await h.profile.assertEnterpriseVisible(first.id, enterprise);
  await rejected(() => h.profile.assertEnterpriseVisible(outside.id, enterprise), 403);
  await rejected(() => h.profile.assertEnterpriseVisible(first.id, { ...enterprise, id: 4 }), 403);
  await rejected(() => h.service.assignEnterprises(overall, '4', [first.id]), 409);
  const overview = await h.service.overview(overall);
  assert.equal(overview.enterprises.find((item) => item.id === first.id).projectUserId, '3');
  assert.equal(overview.enterprises.find((item) => item.id === first.id).salesOwner, input.salesOwner);
  assert.deepEqual(overview.enterprises.find((item) => item.id === first.id).enterpriseProjects, ENTERPRISE_PROJECTS);
  assert.deepEqual(overview.enterprises.find((item) => item.id === second.id).enterpriseProjects, []);
  await h.service.assignEnterprises(overall, '3', [outside.id]);
  assert.equal((await h.client.listAccessibleCompanies(3)).length, 3, 'Direct assignments can cross geographic regions');
  assert.equal((await h.service.overview(overall)).projectAccounts.find((account) => account.id === '3').enterpriseCount, 3);
  h.state().Enterprise[0].regionId = null;
  assert.equal((await h.service.enterpriseDetail(overall, first.id)).regionName, '未设置区域');
  // App membership and exclusive roles determine recipients, not legacy region links.
  h.state().UserApp[1].appCode = 'other-app';
  assert.ok(!(await h.service.overview(overall)).projectAccounts.some((account) => account.id === '4'));
  await rejected(() => h.service.assignEnterprises(overall, '4', [first.id]), 403);
  h.state().UserRole.push({ userId: '5', roleId: '23' });
  assert.ok(!(await h.service.overview(overall)).projectAccounts.some((account) => account.id === '5'));
  await rejected(() => h.service.assignEnterprises(overall, '5', [first.id]), 403);
  h.state().Role.find((role) => role.code === 'region_leader').status = 0;
  await rejected(() => h.service.assignEnterprises(overall, '5', [first.id]), 403);
  // Preserve old owner bindings and reject assigning over another existing owner.
  const legacyCompany = await h.service.createEnterprise(overall, { ...input, name: '既有企业' });
  h.state().EnterpriseOwner.push({ id: '900', enterpriseId: legacyCompany.id, userId: '3', status: 1 });
  assert.equal((await h.service.overview(overall)).enterprises.find((item) => item.id === legacyCompany.id).projectUserId, '3');
  h.state().UserApp[1].appCode = overall.appCode;
  await rejected(() => h.service.assignEnterprises(overall, '4', [legacyCompany.id]), 409);
  await h.service.assignEnterprises(overall, '3', [legacyCompany.id]);
  assert.equal(h.state().EnterpriseOwner.length, 1);
  assert.equal(h.state().EnterpriseTeacher.filter((item) => item.enterpriseId === legacyCompany.id).length, 0);
  assert.ok(h.locks.some((lock) => lock.name === 'Enterprise' && lock.mode === 'pessimistic_write'));
  for (const roles of [['project_teacher'], ['enterprise_owner'], ['region_leader'], ['global_leader'], []]) {
    await rejected(() => h.client.bindClientCompany(3, {}, roles), 403);
  }
  await rejected(() => h.profile.create({}, enterprise), 403);
  const deletion = harness();
  const archive = await deletion.service.createEnterprise(overall, { ...input, name: '待删除档案' });
  const remaining = await deletion.service.createEnterprise(overall, { ...input, name: '保留档案' });
  await deletion.service.assignEnterprises(overall, '3', [archive.id, remaining.id]);
  deletion.state().EnterpriseOwner.push({ id: '901', enterpriseId: archive.id, userId: '3', status: 1 });
  deletion.state().EnterpriseUser.push({ id: '902', enterpriseId: archive.id, userId: '3', status: 1 });
  for (const actor of [region, enterprise]) {
    await rejected(() => deletion.service.deleteAccount(actor, '3'), 403);
    await rejected(() => deletion.service.deleteEnterprise(actor, archive.id), 403);
  }
  await rejected(() => deletion.service.deleteAccount(overall, 'bad'), 400);
  await rejected(() => deletion.service.deleteEnterprise(overall, '0'), 400);
  deletion.fail('EnterpriseUser');
  await assert.rejects(() => deletion.service.deleteEnterprise(overall, archive.id), /Injected/);
  assert.equal(deletion.state().Enterprise.find((item) => item.id === archive.id).status, 1, 'Archive removal rolls back on a binding failure');
  assert.equal(deletion.state().EnterpriseOwner[0].status, 1);
  deletion.fail('');
  await deletion.service.deleteEnterprise(overall, archive.id);
  await rejected(() => deletion.service.deleteEnterprise(overall, archive.id), 404);
  assert.equal(deletion.state().EnterpriseTeacher.find((item) => item.enterpriseId === archive.id).status, 0);
  assert.equal(deletion.state().EnterpriseOwner[0].status, 0);
  assert.equal(deletion.state().EnterpriseUser[0].status, 0);
  assert.deepEqual((await deletion.service.overview(overall)).enterprises.map((item) => item.id), [remaining.id]);
  assert.deepEqual((await deletion.client.listAccessibleCompanies(3)).map((item) => item.enterprise.id), [remaining.id]);
  deletion.state().EnterpriseUser.push({ id: '903', enterpriseId: remaining.id, userId: '3', status: 1 });
  deletion.fail('EnterpriseUser');
  await assert.rejects(() => deletion.service.deleteAccount(overall, '3'), /Injected/);
  assert.equal(deletion.state().User[0].status, 1, 'Account removal rolls back on a binding failure');
  assert.equal(deletion.state().EnterpriseTeacher.find((item) => item.enterpriseId === remaining.id).status, 1);
  deletion.fail('');
  const sessions = new MemorySessionStore();
  const session = await sessions.createSession(enterprise);
  const auth = Object.create(AuthService.prototype);
  auth.sessionStore = sessions;
  auth.userRepository = { findById: async (id) => deletion.state().User.find((item) => item.id === id) ?? null };
  const guard = new AccessTokenGuard(sessions, { verifyAccessToken: () => {} }, { getAllAndOverride: () => false }, auth.userRepository);
  const request = { headers: { authorization: `Bearer ${session.accessToken}` } };
  const context = { switchToHttp: () => ({ getRequest: () => request }), getHandler: () => null, getClass: () => null };
  assert.equal(await guard.canActivate(context), true, 'An active account can use its existing access token');
  await deletion.service.deleteAccount(overall, '3');
  await rejected(() => guard.canActivate(context), 401);
  await rejected(() => auth.refresh(session.refreshToken), 401);
  assert.equal(await sessions.findByRefreshToken(session.refreshToken), null, 'Deleted account refresh token is revoked');
  await rejected(() => deletion.service.deleteAccount(overall, '3'), 404);
  assert.equal(deletion.state().User[0].status, 0);
  assert.equal(deletion.state().UserApp[0].status, 0);
  assert.equal(deletion.state().EnterpriseTeacher.find((item) => item.enterpriseId === remaining.id).status, 0);
  assert.equal(deletion.state().EnterpriseUser.find((item) => item.id === '903').status, 0);
  assert.equal((await deletion.service.overview(overall)).projectAccounts.some((item) => item.id === '3'), false);
  assert.equal((await deletion.service.overview(overall)).enterprises.find((item) => item.id === remaining.id).projectUserId, '');
  await rejected(() => deletion.service.assignEnterprises(overall, '3', [remaining.id]), 403);
  console.log('Governance distribution passed: project multi-select validation/persistence/serialization, legacy compatibility, draft visibility, retired-role denial and cross-region direct assignment, role/app checks, additive assignment, rollback, idempotency, recipient visibility and legacy endpoint denial.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
