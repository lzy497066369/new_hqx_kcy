#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const DIST_ROOT = path.join(BACKEND_ROOT, 'dist');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(BACKEND_ROOT, relativePath), 'utf8');
}

function verifyEntityColumns() {
  for (const file of ['role.entity.ts', 'permission.entity.ts', 'menu.entity.ts']) {
    const source = read(`src/infrastructure/database/entities/${file}`);
    assert(
      source.includes("name: 'app_code'") && source.includes('appCode!'),
      `${file} must declare appCode`,
    );
  }
}

function verifyMigrationContract() {
  const manifest = JSON.parse(read('sql/migrations/manifest.json'));
  const migration = manifest.migrations.find(
    (item) => item.id === '20260805_01_auth_app_scope',
  );
  assert(migration, 'auth application scope migration is missing from the manifest');
  assert(migration.file === 'auth-app-scope-p0.sql', 'auth application scope migration file is incorrect');

  const schema = read('sql/schema.mysql56.sql');
  for (const table of ['sys_app', 'sys_app_client', 'sys_user_app']) {
    assert(schema.includes(`CREATE TABLE IF NOT EXISTS \`${table}\``), `${table} is missing from the baseline schema`);
  }

  const migrationSql = read('sql/auth-app-scope-p0.sql');
  for (const expected of [
    "DEFAULT ''kjqb''",
    'uk_sys_role_app_portal_code',
    'uk_sys_permission_app_portal_code',
    'idx_sys_menu_app_portal_parent',
    "SELECT 'kjqb', '科创企服'",
  ]) {
    assert(migrationSql.includes(expected), `auth application scope migration is missing: ${expected}`);
  }
}

function verifyRuntimeIsolation() {
  const authService = read('src/modules/auth/auth.service.ts');
  for (const expected of [
    'private readonly appRepo: Repository<AppEntity>',
    'private readonly userAppRepo: Repository<UserAppEntity>',
    'item.appCode === appCode',
    'this.extractPermissionsFromRoles(roles)',
  ]) {
    assert(authService.includes(expected), `application runtime isolation is missing: ${expected}`);
  }

  const authController = read('src/modules/auth/auth.controller.ts');
  for (const expected of [
    "@Headers('x-app-code') appCodeHeader?: string",
    'request.currentUser!.appCode',
    'auth_${resolvedAppCode}_${portal}_refresh_token',
  ]) {
    assert(authController.includes(expected), `application cookie isolation is missing: ${expected}`);
  }

  for (const file of [
    'src/modules/system/menu/menu.service.ts',
    'src/modules/system/role/role.service.ts',
  ]) {
    const source = read(file);
    assert(source.includes('appCode'), `${file} must scope management operations by appCode`);
    assert(source.includes('where: { appCode, portalType }'), `${file} must scope lists by appCode`);
  }

  const menuRepository = read('src/infrastructure/database/repositories/menu.repository.ts');
  assert(
    menuRepository.includes('appCode = DEFAULT_AUTH_APP_CODE'),
    'menu repository must scope user menu retrieval by appCode',
  );
}

function main() {
  verifyEntityColumns();
  verifyMigrationContract();
  verifyRuntimeIsolation();
  console.log('Auth application scope stage 2 verification passed.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
