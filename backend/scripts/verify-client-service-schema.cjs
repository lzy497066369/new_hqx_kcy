#!/usr/bin/env node
require('reflect-metadata');
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const { Transactional } = require('../dist/common/services/transaction.service');
const { ClientDeclarationService } = require('../dist/modules/client/services/client-declaration.service');
const { ClientEmployeeService } = require('../dist/modules/client/services/client-employee.service');
const { ClientFinanceService } = require('../dist/modules/client/services/client-finance.service');
const { ClientMaterialService } = require('../dist/modules/client/services/client-material.service');
const { ClientPropertyService } = require('../dist/modules/client/services/client-property.service');
const names = ['client-declaration', 'policy-project', 'enterprise-employee-record', 'enterprise-finance-record', 'enterprise-material', 'enterprise-property-record'];
const entities = names.map((name) => Object.values(require(`../dist/infrastructure/database/entities/${name}.entity`))[0]);

async function main() {
  // Build real TypeORM metadata without opening any database connection.
  const dataSource = new DataSource({ type: 'mysql', database: 'schema_test', entities });
  await dataSource.buildMetadatas();
  function repository(entity) {
    const real = dataSource.getRepository(entity);
    const columns = new Set(real.metadata.columns.map((column) => column.propertyName));
    const state = { saved: [], updates: [], found: [], rows: [], queries: [] };
    const ensureColumns = (value) => {
      for (const key of Object.keys(value)) assert.ok(columns.has(key), `${entity.name}: nonexistent column ${key}`);
    };
    const query = {};
    for (const name of ['where', 'andWhere', 'orderBy']) query[name] = (...args) => { state.queries.push(args); return query; };
    query.getMany = async () => state.rows;
    return Object.assign(state, {
      create: real.create.bind(real),
      save: async (input) => {
        const rows = Array.isArray(input) ? input : [input];
        rows.forEach((row) => { assert.ok(!Array.isArray(row)); ensureColumns(row); });
        state.saved.push(...rows);
        return input;
      },
      update: async (where, value) => { ensureColumns(where); ensureColumns(value); state.updates.push({ where, value }); return { affected: 1 }; },
      find: async (options) => { ensureColumns(options.where); state.found.push(options); return state.rows; },
      findOne: async (options) => { ensureColumns(options.where); assert.ok(!options.relations, 'Do not request unmapped entity relations'); state.found.push(options); return state.rows[0] ?? null; },
      createQueryBuilder: () => query,
    });
  }
  const [declarationRepo, policyRepo, employeeRepo, financeRepo, materialRepo, propertyRepo] = entities.map(repository);
  const declarations = new ClientDeclarationService(declarationRepo, {}, {}, {}, {}, policyRepo);
  await declarations.submitDeclaration('d1', 'company-1', 7);
  assert.deepEqual(declarationRepo.updates[0].where, { id: 'd1', enterpriseId: 'company-1' });
  assert.ok(declarationRepo.updates[0].value.submitTime instanceof Date);
  assert.equal(declarationRepo.updates[0].value.status, 'submitted');
  await declarations.getCandidateProjects('company-1');
  assert.deepEqual(policyRepo.found[0].where, { enabled: 1 });

  const employees = new ClientEmployeeService(employeeRepo);
  await employees.batchCreateEmployees('company-1', [{ enterpriseId: 'foreign-company', name: '测试员工', hireDate: '2026-01-01', employmentType: 1, education: 3 }]);
  const employee = employeeRepo.saved[0];
  assert.equal(employee.enterpriseId, 'company-1');
  assert.equal(employee.ygName, '测试员工');
  assert.equal(employee.entryDate, '2026-01-01');
  assert.equal(employee.ygLx, 1);
  assert.equal(employee.ygXl, 3);
  employeeRepo.rows = [employee];
  assert.equal((await employees.exportEmployees('company-1'))[0].姓名, '测试员工');
  const stats = await employees.getEmployeeStats('company-1');
  assert.equal(stats.byEmploymentType[1], 1);
  assert.equal(stats.byEducation[3], 1);
  await employees.listEmployees('company-1', { employmentType: 1, keyword: '测试' });
  assert.ok(employeeRepo.queries.some(([sql]) => sql.includes('employee.ygName')));
  assert.ok(employeeRepo.queries.some(([sql]) => sql.includes('employee.ygLx')));

  const finance = new ClientFinanceService(financeRepo, {}, {}, {});
  await finance.batchCreateFinanceRecords('company-1', [{ enterpriseId: 'foreign-company', year: '2026', recordType: 'annual', xxsr: 123 }]);
  assert.equal(financeRepo.saved[0].enterpriseId, 'company-1');
  assert.equal(financeRepo.saved[0].xxsr, 123);
  await finance.deleteFinanceRecord('f1', 'company-1');
  await finance.restoreFinanceRecord('f1', 'company-1');
  assert.deepEqual(financeRepo.updates.map(({ value }) => value), [{ status: 0 }, { status: 1 }]);
  await finance.listFinanceRecords('company-1', { year: '2026' });
  assert.ok(financeRepo.queries.some(([sql]) => sql.includes('record.status')));
  assert.ok(financeRepo.queries.some(([sql]) => sql.includes('record.year')));
  assert.ok(financeRepo.queries.every(([sql]) => !sql.includes('record.period')));

  const materials = new ClientMaterialService(materialRepo, {}, {}, {});
  const materialInput = { title: '材料.pdf', category: 'research', filePath: '/uploads/material.pdf', fileSize: 1024, mimeType: 'application/pdf' };
  await materials.uploadMaterial('company-1', 7, materialInput);
  await materials.batchUploadMaterials('company-1', 7, [materialInput]);
  assert.equal(materialRepo.saved.length, 2);
  materialRepo.saved.forEach((row) => {
    assert.equal(row.enterpriseId, 'company-1');
    assert.equal(row.fileName, materialInput.title);
    assert.equal(row.materialType, materialInput.category);
    assert.equal(row.filePath, materialInput.filePath);
  });
  materialRepo.rows = [materialRepo.saved[0]];
  const preview = await materials.previewMaterial('m1', 'company-1');
  assert.equal(preview.title, materialInput.title);
  assert.equal(preview.category, materialInput.category);
  assert.equal(preview.fileSize, null);

  const properties = new ClientPropertyService(propertyRepo, {}, {}, {});
  await properties.batchCreateProperties('company-1', [{ enterpriseId: 'foreign-company', recordType: 'intellectual_property' }]);
  assert.equal(propertyRepo.saved[0].enterpriseId, 'company-1');

  for (const fail of [false, true]) {
    const originalRepository = { target: entities[0] };
    const transactionRepository = { target: entities[0], transaction: true };
    const host = { repo: originalRepository, dataSource: { transaction: async (fn) => fn({ getRepository: () => transactionRepository }) } };
    const descriptor = { value: async function () { assert.equal(this.repo, transactionRepository); if (fail) throw new Error('expected rollback'); return 'ok'; } };
    Transactional()(host, 'run', descriptor);
    if (fail) await assert.rejects(() => descriptor.value.call(host), /expected rollback/);
    else assert.equal(await descriptor.value.call(host), 'ok');
    assert.equal(host.repo, originalRepository, 'Restore the original repository on both success and error');
  }
  console.log('Client service schema verification passed: real entity columns, scoped batch writes, submission, finance status, employee mappings, material metadata and transaction restoration.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
