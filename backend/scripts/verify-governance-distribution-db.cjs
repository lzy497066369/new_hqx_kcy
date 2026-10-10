/** Local-only integration check. All fixture accounts, regions and enterprises are rolled back. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const { ENTERPRISE_PROJECTS } = require('../dist/common/constants/enterprise-projects');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { ClientGovernanceService } = require('../dist/modules/client-governance/governance.service');
const { ClientService } = require('../dist/modules/client/client.service');
const entity = (file, name) => require(`../dist/infrastructure/database/entities/${file}.entity`)[name];
const E = {
  userRepo: entity('user', 'UserEntity'), regionRepo: entity('region', 'RegionEntity'),
  roleRepo: entity('role', 'RoleEntity'), userRoleRepo: entity('user-role', 'UserRoleEntity'),
  userAppRepo: entity('user-app', 'UserAppEntity'), ownerRepo: entity('enterprise-owner', 'EnterpriseOwnerEntity'),
  teacherRepo: entity('enterprise-teacher', 'EnterpriseTeacherEntity'), enterpriseRepo: entity('enterprise', 'EnterpriseEntity'),
};
async function main() {
  const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '../.env'), 'utf8').split(/\r?\n/).filter((line) => line.includes('=') && !line.trim().startsWith('#')).map((line) => {
    const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
  }));
  if (!['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)) throw new Error('Refusing integration writes against a non-local database');
  const source = new DataSource({ type: 'mysql', host: env.DB_HOST, port: Number(env.DB_PORT || 3306), username: env.DB_USERNAME, password: env.DB_PASSWORD, database: env.DB_DATABASE, entities: [path.join(__dirname, '../dist/infrastructure/database/entities/*.entity.js')], synchronize: false, logging: false });
  await source.initialize();
  const runner = source.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    const service = Object.create(ClientGovernanceService.prototype);
    for (const [key, Entity] of Object.entries(E)) service[key] = runner.manager.getRepository(Entity);
    const suffix = randomUUID().slice(0, 8);
    const region = await service.regionRepo.save(service.regionRepo.create({ name: `分发验证-${suffix}`, level: 'province', status: 1, sortNum: 999 }));
    const global = { id: 1, username: 'integration-test', portal: 'client', roles: ['global_leader'] };
    const recipient = await service.createAccount(global, { name: '验证企业负责人', username: `test_owner_${suffix}`, password: `Test-${suffix}-123` });
    const other = await service.createAccount(global, { name: '验证其他负责人', username: `test_other_${suffix}`, password: `Test-${suffix}-123` });
    const first = await service.createEnterprise(global, { name: `验证企业一-${suffix}`, regionId: String(region.id), salesOwner: '销售甲', enterpriseProjects: [...ENTERPRISE_PROJECTS], preDeclarationYear: 2027 });
    const second = await service.createEnterprise(global, { name: `验证企业二-${suffix}`, regionId: String(region.id), salesOwner: '销售乙', enterpriseProjects: [ENTERPRISE_PROJECTS[0]], preDeclarationYear: 2028 });
    assert.equal((await service.overview(global)).enterprises.filter((item) => [first.id, second.id].includes(item.id)).length, 2);
    const savedFirst = await service.enterpriseRepo.findOneBy({ id: first.id });
    assert.equal(savedFirst.creditCode, null);
    assert.deepEqual(savedFirst.enterpriseProjects, ENTERPRISE_PROJECTS, 'TEXT JSON round-trip must preserve all projects');
    assert.deepEqual((await service.enterpriseRepo.findOneBy({ id: second.id })).enterpriseProjects, [ENTERPRISE_PROJECTS[0]]);
    await service.assignEnterprises(global, recipient.id, [first.id]);
    await service.assignEnterprises(global, recipient.id, [second.id]);
    const client = Object.create(ClientService.prototype);
    client.iamCompanyScope = { isEnabled: () => false };
    client.enterpriseTeacherRepo = service.teacherRepo;
    client.enterpriseOwnerRepo = runner.manager.getRepository(entity('enterprise-owner', 'EnterpriseOwnerEntity'));
    client.enterpriseUserRepo = runner.manager.getRepository(entity('enterprise-user', 'EnterpriseUserEntity'));
    assert.deepEqual((await client.listAccessibleCompanies(Number(recipient.id))).map((item) => String(item.enterprise.id)).sort(), [first.id, second.id].sort());
    const received = (await client.listAccessibleCompanies(Number(recipient.id))).find((item) => String(item.enterprise.id) === first.id);
    const receipt = client.toClientCompany(received, first.id);
    assert.equal(receipt.salesOwner, '销售甲');
    assert.equal(receipt.preDeclarationYear, 2027);
    assert.deepEqual(receipt.enterpriseProjects, ENTERPRISE_PROJECTS);
    assert.equal((await client.listAccessibleCompanies(Number(other.id))).length, 0);
    const overview = await service.overview(global);
    assert.ok(overview.enterprises.filter((item) => [first.id, second.id].includes(item.id)).every((item) => item.projectUserId === recipient.id));
    assert.deepEqual(overview.enterprises.find((item) => item.id === first.id).enterpriseProjects, ENTERPRISE_PROJECTS);
    assert.equal(overview.projectAccounts.find((item) => item.id === recipient.id).enterpriseCount, 2);
    await assert.rejects(() => service.assignEnterprises(global, other.id, [first.id]), (error) => error.getStatus?.() === 409);
    console.log('Local database integration passed: direct account creation, multi-project persistence and recipient serialization, unassigned overview, account creation, distribution, preserved existing assignments, recipient visibility and account isolation. Fixtures rolled back.');
  } finally {
    await runner.rollbackTransaction();
    await runner.release();
    await source.destroy();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
