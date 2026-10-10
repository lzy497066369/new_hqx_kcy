#!/usr/bin/env node
require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { splitStatements } = require('./execute-sql-file.cjs');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { CreateGovernanceAccountDto } = require('../dist/modules/client-governance/dto');
const { AuthService } = require('../dist/modules/auth/auth.service');
const { AccessTokenGuard } = require('../dist/common/guards/access-token.guard');
const { RegionAccessService } = require('../dist/modules/policy/shared/region-access.service');
const { verifyPassword, isPasswordHash } = require('../dist/common/utils/password.util');
const { harness, appCode, overall, retired, enterprise, rejected } = require('./helpers/client-governance-harness.cjs');
const input = { name: 'Test Leader', username: 'enterprise_test', password: 'Test-Initial-987' };
function verifyRetirementMigrationContract() {
  const root = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'sql/migrations/manifest.json'), 'utf8'));
  const entry = manifest.migrations.find((item) => item.id === '20261001_03_governance_direct_enterprise_accounts');
  assert.ok(entry, 'Forward migration must be registered');
  const sql = fs.readFileSync(path.join(root, 'sql', entry.file), 'utf8');
  const statements = splitStatements(sql).map((statement) => statement.replace(/^--.*$/gm, '').trim());
  assert.equal(statements.length, 7);
  assert.ok(statements.every((statement) => /^UPDATE\b/.test(statement)), 'Retirement must not delete historical records');
  assert.match(statements[0], /WHERE e\.region_id IS NULL/);
  assert.match(sql, /r\.app_code = ua\.app_code AND r\.portal_type = ua\.portal_type/);
  assert.match(sql, /r\.code = 'region_leader' AND r\.portal_type = 'client'/);
  assert.doesNotMatch(statements.join('\n'), /UPDATE\s+(?:sys_user|biz_enterprise_teacher|biz_enterprise_owner)\s/i);
  assert.equal(fs.existsSync(path.join(root, 'src/infrastructure/database/entities/region-project-user.entity.ts')), false);
  const databaseModule = fs.readFileSync(path.join(root, 'src/infrastructure/database/database.module.ts'), 'utf8');
  assert.ok(!databaseModule.includes('RegionProjectUserEntity'));
}
async function main() {
  verifyRetirementMigrationContract();
  const dto = plainToInstance(CreateGovernanceAccountDto, { ...input, name: '  Test Leader  ', username: '  enterprise_test  ' });
  assert.equal((await validate(dto)).length, 0);
  assert.equal(dto.username, input.username);
  for (const changes of [{ name: ' ' }, { username: 'ab' }, { password: 'short' }, { password: ' Test-Initial-987' }]) {
    assert.ok((await validate(plainToInstance(CreateGovernanceAccountDto, { ...input, ...changes }))).length);
  }
  const h = harness({ seedAccounts: false });
  h.state().Region = []; // Account creation no longer depends on an available region.
  const created = await h.service.createAccount(overall, { ...input, name: '  Test Leader  ', username: '  enterprise_test  ' });
  assert.equal(created.name, input.name);
  assert.equal(created.username, input.username);
  assert.equal(created.initialPassword, input.password);
  assert.equal(created.role, 'project_teacher');
  assert.equal('regionId' in created, false);
  const state = h.state(), stored = state.User[0];
  assert.ok(isPasswordHash(stored.password));
  assert.ok(await verifyPassword(input.password, stored.password));
  assert.deepEqual(state.UserRole.map((link) => link.roleId), ['20']);
  assert.equal(state.UserApp[0].appCode, appCode);
  assert.equal(state.UserApp[0].status, 1);
  assert.equal(stored.homePath, '/client/enterprise-receipts');
  assert.equal(state.UserApp[0].homePath, '/client/enterprise-receipts');
  assert.equal((await h.client.listAccessibleCompanies(Number(created.id))).length, 0);
  const auth = Object.create(AuthService.prototype);
  auth.userRepository = { findByLoginAccountWithRelations: async (username) => username === stored.username ? { ...stored, userRoles: state.UserRole.map((link) => ({ ...link, role: state.Role.find((role) => role.id === link.roleId) })) } : null };
  auth.appRepo = { findOne: async () => ({ code: appCode, defaultPortal: 'client', status: 1 }) };
  auth.userAppRepo = h.repos.UserApp;
  auth.sessionStore = { createSession: async (user) => ({ user }) };
  const session = await auth.login({ username: input.username, password: input.password, portal: 'client', appCode });
  assert.deepEqual(session.user.roles, ['project_teacher']);
  assert.equal(session.user.id, Number(created.id));
  await rejected(() => auth.login({ username: input.username, password: 'wrong-password', portal: 'client', appCode }), 401);
  const overview = await h.service.overview(overall);
  assert.equal(overview.projectAccounts[0].username, input.username);
  assert.ok(!JSON.stringify(overview).includes(stored.password));
  assert.ok(!JSON.stringify(overview).includes(input.password));
  await rejected(() => h.service.createAccount(overall, input), 409);
  await h.service.createAccount(overall, { ...input, username: 'another_enterprise' });
  assert.equal(state.User.length, 2, 'Multiple direct accounts can be created without regional intermediaries');
  for (const actor of [retired, enterprise, { ...overall, roles: ['global_leader', 'region_leader'] }, { ...overall, roles: ['global_leader', 'project_teacher'] }, { ...overall, portal: 'admin' }, { ...overall, appCode: 'other-app' }]) {
    await rejected(() => h.service.createAccount(actor, input), 403);
    await rejected(() => h.service.overview(actor), 403);
  }
  const disabled = harness({ seedAccounts: false }); disabled.state().Role[0].status = 0;
  await rejected(() => disabled.service.createAccount(overall, input), 409);
  assert.equal(disabled.state().User.length, 0);
  const missing = harness({ seedAccounts: false }); missing.state().Role = [];
  await missing.service.createAccount(overall, input);
  assert.equal(missing.state().Role[0].code, 'project_teacher');
  for (const failAt of ['Role', 'User', 'UserRole', 'UserApp']) {
    const failed = harness({ seedAccounts: false }); failed.state().Role = []; failed.fail(failAt);
    await assert.rejects(() => failed.service.createAccount(overall, input), /Injected/);
    assert.equal(failed.state().User.length, 0); assert.equal(failed.state().UserRole.length, 0); assert.equal(failed.state().UserApp.length, 0); assert.equal(failed.state().Role.length, 0);
  }
  // Retired roles are rejected even if inactive or accompanied by a valid role.
  state.UserRole.push({ userId: created.id, roleId: '23' }); state.Role.find((role) => role.id === '23').status = 0;
  await rejected(() => auth.login({ username: input.username, password: input.password, portal: 'client', appCode }), 401);
  // Cached sessions cannot keep exercising the deleted chain.
  const guard = new AccessTokenGuard({ findByAccessToken: async () => ({ user: retired }) }, { verifyAccessToken: () => {} });
  const request = { headers: { authorization: 'Bearer cached.regional.token' } };
  await rejected(() => guard.canActivate({ switchToHttp: () => ({ getRequest: () => request }), getHandler: () => null, getClass: () => null }), 401);
  const access = new RegionAccessService({ find: async () => { throw new Error('Old leader mapping must not be queried'); } });
  assert.equal((await access.getAccessibleRegionIds(retired)).size, 0);
  await rejected(() => access.assertHasRegionAccess(retired), 403);
  assert.equal(await access.getAccessibleRegionIds({ ...overall, roles: ['admin'] }), null);
  console.log('Client governance passed: direct creation, password hashing, login before assignment, role/app isolation, retired sessions, policy access, transaction rollback and non-destructive retirement migration contract.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
