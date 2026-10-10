const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const schemaPath = path.join(__dirname, '..', 'sql', '001-init-iam-schema.sql');
const oauthSchemaPath = path.join(__dirname, '..', 'sql', '002-oauth-sso-schema.sql');
const accessSchemaPath = path.join(__dirname, '..', 'sql', '004-access-control-schema.sql');
const platformDepartmentSchemaPath = path.join(__dirname, '..', 'sql', '011-platform-department-replace-company-department.sql');
const contextSchemaPath = path.join(__dirname, '..', 'sql', '009-user-app-context.sql');
const appCompanySourceSchemaPath = path.join(__dirname, '..', 'sql', '010-app-company-source-system.sql');

test('defines the first IAM persistence boundary', () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');

  for (const table of [
    'iam_app',
    'iam_user',
    'iam_company',
    'iam_company_member',
    'iam_user_company_scope',
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`));
  }

  assert.match(schema, /UNIQUE KEY uk_iam_app_code \(app_code\)/);
  assert.match(schema, /UNIQUE KEY uk_iam_user_username \(username\)/);
  assert.match(schema, /source_user_id VARCHAR\(64\) NULL/);
  assert.match(schema, /UNIQUE KEY uk_iam_company_member \(company_id, user_id, app_code, member_type\)/);
  assert.match(schema, /UNIQUE KEY uk_iam_user_company_scope \(user_id, app_code, company_id, relation_type\)/);
});

test('defines application scoped roles, permissions, menus, and assignments', () => {
  const schema = fs.readFileSync(accessSchemaPath, 'utf8');
  for (const table of ['iam_role', 'iam_permission', 'iam_role_permission', 'iam_user_role', 'iam_menu']) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`));
  }
  assert.match(schema, /UNIQUE KEY uk_iam_role_app_code \(app_code, role_code\)/);
  assert.match(schema, /UNIQUE KEY uk_iam_permission_app_code \(app_code, permission_code\)/);
  assert.match(schema, /UNIQUE KEY uk_iam_user_role \(user_id, app_code, role_id\)/);
});

test('defines OAuth2 PKCE, SSO session, and refresh-token persistence', () => {
  const schema = fs.readFileSync(oauthSchemaPath, 'utf8');

  for (const table of [
    'iam_user_app',
    'iam_oauth_client',
    'iam_oauth_authorization_code',
    'iam_sso_session',
    'iam_refresh_token',
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`));
  }

  assert.match(schema, /UNIQUE KEY uk_iam_oauth_client_id \(client_id\)/);
  assert.match(schema, /UNIQUE KEY uk_iam_oauth_code_hash \(code_hash\)/);
  assert.match(schema, /UNIQUE KEY uk_iam_refresh_token_hash \(token_hash\)/);
});

test('defines platform departments and removes the unused company-department domain', () => {
  const schema = fs.readFileSync(platformDepartmentSchemaPath, 'utf8');
  for (const table of ['iam_platform_department', 'iam_user_platform_department']) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`));
  }
  assert.match(schema, /UNIQUE KEY uk_iam_platform_department_code \(dept_code\)/);
  assert.match(schema, /UNIQUE KEY uk_iam_user_platform_department \(department_id, user_id\)/);
  assert.match(schema, /DROP TABLE IF EXISTS iam_user_department/);
  assert.match(schema, /DROP TABLE IF EXISTS iam_department/);
});

test('defines an application-level active company context', () => {
  const schema = fs.readFileSync(contextSchemaPath, 'utf8');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS iam_user_app_context \(/);
  assert.match(schema, /UNIQUE KEY uk_iam_user_app_context \(user_id, app_code\)/);
});

test('defines an application company source domain', () => {
  const schema = fs.readFileSync(appCompanySourceSchemaPath, 'utf8');
  assert.match(schema, /company_source_system/);
  assert.match(schema, /ALTER TABLE iam_app ADD COLUMN company_source_system/);
});

test('retires only the regional client persona without deleting users or company bindings', () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'sql', '012-retire-regional-leader.sql'), 'utf8');
  const statements = schema.replace(/^--.*$/gm, '');
  assert.match(statements, /ur\.user_id = ua\.user_id AND ur\.app_code = ua\.app_code/);
  assert.match(statements, /r\.id = ur\.role_id AND r\.app_code = ua\.app_code/);
  assert.match(statements, /SET ua\.status = 0/);
  assert.match(statements, /r\.app_code = 'kjqb_client' AND r\.role_code = 'region_leader'/);
  assert.match(statements, /UPDATE iam_role SET status = 0/);
  assert.match(statements, /UPDATE iam_menu SET status = 0/);
  assert.doesNotMatch(statements, /\b(?:DELETE|DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(statements, /UPDATE\s+(?:iam_user|iam_company|iam_company_member|iam_user_company_scope)\s/i);
});
