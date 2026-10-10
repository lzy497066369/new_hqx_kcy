#!/usr/bin/env node
const assert = require('node:assert/strict');
const { QueryFailedError } = require('typeorm');
const { ClientService } = require('../dist/modules/client/client.service');

function duplicateError() {
  return new QueryFailedError('INSERT INTO biz_client_user_profile ...', [],
    Object.assign(new Error('Duplicate user profile'), { code: 'ER_DUP_ENTRY', errno: 1062 }));
}

function fixture(initialProfile, companies = [{
  bindingDefault: true,
  enterprise: { id: '101', name: 'Test company', status: 1 },
  roleName: '企业负责人',
}]) {
  const rows = new Map(initialProfile ? [[initialProfile.userId, { ...initialProfile }]] : []);
  const service = Object.create(ClientService.prototype);
  let insertCount = 0;
  service.clientUserProfileRepo = {
    findOne: async ({ where }) => rows.has(where.userId) ? { ...rows.get(where.userId) } : null,
    create: (value) => ({ ...value }),
    save: async (value) => {
      if (!value.id) {
        if (rows.has(value.userId)) throw duplicateError();
        value = { ...value, id: String(++insertCount) };
      }
      rows.set(value.userId, { ...value });
      return { ...value };
    },
  };
  service.userRepository = { findById: async (id) => ({ id, username: 'test-owner', status: 1 }) };
  service.listAccessibleCompanies = async () => companies;
  return { service, rows, get insertCount() { return insertCount; } };
}

async function main() {
  // Login loads /client/me, /client/companies and /client/current-company in parallel.
  const firstLogin = fixture();
  const [me, companies, current] = await Promise.all([
    firstLogin.service.getClientMe(5),
    firstLogin.service.getClientCompanies(5),
    firstLogin.service.getCurrentClientCompany(5),
  ]);
  assert.equal(me.id, '5');
  assert.equal(companies[0].id, '101');
  assert.equal(current.id, '101');
  assert.equal(firstLogin.insertCount, 1);
  assert.equal(firstLogin.rows.get('5').currentEnterpriseId, '101');

  // Separate service instances sharing a repository simulate multiple server workers.
  const crossWorker = fixture();
  const otherWorker = Object.assign(Object.create(ClientService.prototype), crossWorker.service);
  const profiles = await Promise.all(Array.from({ length: 20 }, (_, index) =>
    (index % 2 ? otherWorker : crossWorker.service).getOrCreateClientUserProfile(5)));
  assert.equal(new Set(profiles.map((profile) => profile.id)).size, 1);
  assert.equal(crossWorker.insertCount, 1);

  // Existing selections and profile fields must not be reset on login.
  const stored = { id: '9', userId: '5', currentEnterpriseId: '202', position: '经理', roleName: '负责人', remark: 'keep' };
  const existing = fixture(stored, [
    { bindingDefault: true, enterprise: { id: '101', status: 1 } },
    { bindingDefault: false, enterprise: { id: '202', status: 1 } },
  ]);
  assert.equal((await existing.service.getCurrentClientCompany(5)).id, '202');
  assert.deepEqual(existing.rows.get('5'), stored);
  assert.equal(existing.insertCount, 0);

  // New accounts without assignments can still log in; accounts stay isolated.
  const unassigned = fixture(undefined, []);
  assert.deepEqual(await unassigned.service.getClientCompanies(5), []);
  assert.equal(await unassigned.service.getCurrentClientCompany(5), null);
  await unassigned.service.getClientMe(6);
  assert.equal(unassigned.rows.size, 2);
  assert.equal(unassigned.rows.get('5').currentEnterpriseId, null);

  // Only an actual duplicate followed by a visible winner may be recovered.
  for (const error of [new Error('Database unavailable'), duplicateError()]) {
    const failed = fixture();
    failed.service.clientUserProfileRepo.save = async () => { throw error; };
    await assert.rejects(() => failed.service.getOrCreateClientUserProfile(5), (actual) => actual === error);
  }
  const readFailure = fixture();
  const unavailable = new Error('Read failed');
  readFailure.service.clientUserProfileRepo.findOne = async () => { throw unavailable; };
  await assert.rejects(() => readFailure.service.getOrCreateClientUserProfile(5), (error) => error === unavailable);
  console.log('Client profile concurrency verification passed (parallel login, cross-worker race, existing profile, unassigned accounts, error propagation).');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
