#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const distRoot = path.join(backendRoot, 'dist');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertRejected(callback, message) {
  try {
    await callback();
  } catch (error) {
    assert(error?.status === 400, `${message}: expected HTTP 400`);
    return;
  }
  throw new Error(`${message}: request was unexpectedly accepted`);
}

async function main() {
  const servicePath = path.join(distRoot, 'modules/client/client.service.js');
  assert(fs.existsSync(servicePath), 'Missing build artifact. Run npm run build first.');
  const { ClientService } = require(servicePath);
  const service = Object.create(ClientService.prototype);
  const enterprise = {
    creditCode: '91310000TEST123456',
    name: '上海示例科技有限公司',
    shortName: '示例科技',
  };

  service.extractUploadedFileOwnershipText = async () =>
    '购买方名称：上海示例科技有限公司\n统一社会信用代码：91310000TEST123456';
  let check = await service.checkUploadedFileOwnership(enterprise, {}, 'invoice');
  assert(check.status === 'matched', 'current enterprise invoice must be accepted');

  service.extractUploadedFileOwnershipText = async () =>
    '甲方：上海示例科技有限公司\n乙方：北京合作方有限公司\n统一社会信用代码：91110000ABCD123456';
  check = await service.checkUploadedFileOwnership(enterprise, {}, 'contract');
  assert(check.status === 'matched', 'contract must allow the current enterprise as either party');

  service.extractUploadedFileOwnershipText = async () =>
    '统一社会信用代码：91110000ABCD123456';
  check = await service.checkUploadedFileOwnership(enterprise, {}, 'finance');
  assert(check.status === 'mismatched', 'other enterprise credit code must be rejected');

  service.extractUploadedFileOwnershipText = async () =>
    '销售方名称：北京合作方有限公司';
  check = await service.checkUploadedFileOwnership(enterprise, {}, 'invoice');
  assert(check.status === 'mismatched', 'other enterprise name must be rejected without a credit code');

  service.enterpriseRepo = { findOne: async () => enterprise };
  let cleanupCount = 0;
  service.removeRejectedUploadedFiles = async () => {
    cleanupCount += 1;
  };
  await assertRejected(
    () => service.assertUploadedFilesBelongToEnterprise('1', [{ originalname: 'other.pdf' }], 'invoice'),
    'other enterprise invoice',
  );
  assert(cleanupCount === 1, 'rejected upload must clean up temporary files');

  service.extractUploadedFileOwnershipText = async () => '';
  await service.assertUploadedFilesBelongToEnterprise(
    '1',
    [{ originalname: 'unknown.pdf' }],
    'finance',
  );
  assert(cleanupCount === 1, 'unverifiable upload must not clean up temporary files');
  await service.assertStoredMaterialsBelongToEnterprise(
    '1',
    [{ fileName: 'unknown.pdf', filePath: '' }],
    'ip',
  );

  const source = fs.readFileSync(
    path.join(backendRoot, 'src/modules/client/client.service.ts'),
    'utf8',
  );
  for (const scene of ['material', 'employee', 'finance', 'contract', 'invoice', 'ip']) {
    assert(
      source.includes(`assertUploadedFilesBelongToEnterprise(enterpriseId, validFiles, '${scene}')`) ||
        source.includes(`assertUploadedFilesBelongToEnterprise(enterpriseId, [file], '${scene}')`),
      `${scene} upload entry is missing ownership validation`,
    );
  }
  assert(
    source.includes("assertStoredMaterialsBelongToEnterprise(enterpriseId, materials, 'ip')"),
    'existing IP materials must be checked before starting recognition',
  );

  console.log('Enterprise material ownership verification passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
