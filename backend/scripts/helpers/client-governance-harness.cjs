require('reflect-metadata');
const assert = require('node:assert/strict');
const { ClientGovernanceService } = require('../../dist/modules/client-governance/governance.service');
const { ClientService } = require('../../dist/modules/client/client.service');
const { EnterpriseProfileService } = require('../../dist/modules/enterprise/profile/profile.service');
const { resolveAuthRuntimeConfig } = require('../../dist/modules/auth/auth-runtime.config');
const names = ['Enterprise', 'EnterpriseTeacher', 'EnterpriseOwner', 'EnterpriseUser', 'Region', 'User', 'UserRole', 'UserApp', 'Role'];
const entities = Object.fromEntries(names.map((name) => [name, require(`../../dist/infrastructure/database/entities/${name.replace(/[A-Z]/g, (char, i) => `${i ? '-' : ''}${char.toLowerCase()}`)}.entity`)[`${name}Entity`]]));
const appCode = resolveAuthRuntimeConfig().appCode;
const overall = { id: 1, username: 'overall', portal: 'client', appCode, roles: ['global_leader'] };
const retired = { ...overall, id: 2, roles: ['region_leader'] };
const enterprise = { ...overall, id: 3, roles: ['project_teacher'] };
function harness({ seedAccounts = true } = {}) {
  let state = Object.fromEntries(names.map((name) => [name, []]));
  state.Region = [{ id: '10', name: '区域A', status: 1 }, { id: '11', name: '区域B', status: 1 }];
  state.Role = ['project_teacher', 'enterprise_owner', 'global_leader', 'region_leader'].map((code, i) => ({ id: String(20 + i), code, status: 1, appCode, portalType: 'client' }));
  if (seedAccounts) {
    state.User = [3, 4, 5].map((id) => ({ id: String(id), realName: `负责人${id}`, username: `owner${id}`, status: 1, portalType: 'client' }));
    state.UserRole = [3, 4, 5].map((id) => ({ userId: String(id), roleId: '20' }));
    state.UserApp = [3, 4, 5].map((id) => ({ id: String(id + 1000), userId: String(id), appCode, portalType: 'client', status: 1 }));
  }
  let sequence = 100, failAt = '';
  const locks = [];
  const matches = (item, where) => !where || (Array.isArray(where) ? where.some((clause) => matches(item, clause)) : Object.entries(where).every(([key, value]) => value?._type === 'in' ? value._value.map(String).includes(String(item[key])) : String(item[key]) === String(value)));
  const repos = Object.fromEntries(names.map((name) => [name, {
    create: (record) => ({ ...record }),
    find: async (options) => state[name].filter((item) => matches(item, options?.where)).map((item) => {
      const result = { ...item };
      for (const [key, entity, field] of [['enterprise', 'Enterprise', 'enterpriseId'], ['teacher', 'User', 'teacherUserId'], ['user', 'User', 'userId'], ['role', 'Role', 'roleId']]) {
        if (options?.relations?.[key]) result[key] = state[entity].find((record) => String(record.id) === String(item[field]));
      }
      return result;
    }),
    findOne: async (options) => { if (options?.lock) locks.push({ name, mode: options.lock.mode }); return (await repos[name].find(options))[0] ?? null; },
    insert: async (record) => repos[name].save(record),
    save: async (record) => {
      if (failAt === name) throw new Error('Injected save failure');
      const saved = { id: String(sequence++), ...record };
      const index = state[name].findIndex((item) => item.id === saved.id);
      if (index < 0) state[name].push(saved); else state[name][index] = saved;
      return saved;
    },
  }]));
  const manager = {
    getRepository: (entity) => repos[Object.entries(entities).find(([, candidate]) => candidate === entity)[0]],
    transaction: async (callback) => { const before = structuredClone(state); try { return await callback(manager); } catch (error) { Object.assign(state, before); throw error; } },
  };
  Object.values(repos).forEach((repo) => { repo.manager = manager; });
  const service = Object.create(ClientGovernanceService.prototype);
  Object.assign(service, { enterpriseRepo: repos.Enterprise, teacherRepo: repos.EnterpriseTeacher, ownerRepo: repos.EnterpriseOwner, regionRepo: repos.Region, userRepo: repos.User, roleRepo: repos.Role, userRoleRepo: repos.UserRole, userAppRepo: repos.UserApp });
  const bindings = { iamCompanyScope: { isEnabled: () => false }, enterpriseRepo: repos.Enterprise, enterpriseOwnerRepo: repos.EnterpriseOwner, enterpriseTeacherRepo: repos.EnterpriseTeacher, enterpriseUserRepo: repos.EnterpriseUser };
  const client = Object.assign(Object.create(ClientService.prototype), bindings);
  const profile = Object.assign(Object.create(EnterpriseProfileService.prototype), bindings);
  return { service, client, profile, repos, locks, state: () => state, fail: (name) => { failAt = name; } };
}
const rejected = (callback, status) => assert.rejects(callback, (error) => error.getStatus?.() === status);
module.exports = { harness, appCode, overall, retired, enterprise, rejected };
