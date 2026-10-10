const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const scriptPath = path.join(__dirname, '..', 'scripts', 'import-legacy-data.cjs');

test('defines a dry-run, idempotent import for the first two applications', () => {
  const script = fs.readFileSync(scriptPath, 'utf8');

  assert.match(script, /const apply = process\.argv\.includes\('--apply'\)/);
  assert.match(script, /kjqb_admin/);
  assert.match(script, /kjqb_client/);
  assert.match(script, /ON DUPLICATE KEY UPDATE/);
  assert.match(script, /source_system/);
  assert.match(script, /source_user_id/);
  assert.match(script, /project_teacher/);
  assert.match(script, /resource_type.*menu/);
  assert.match(script, /sys_dept/);
  assert.match(script, /iam_platform_department/);
  assert.match(script, /iam_user_platform_department/);
});

test('does not reimport the retired regional persona or reactivate its client membership', () => {
  const script = fs.readFileSync(scriptPath, 'utf8');

  assert.match(script, /role\.portal_type === 'client' && role\.code === 'region_leader'\)\) continue/);
  assert.match(script, /sourceRole\.portal_type === 'client' && sourceRole\.code === 'region_leader'\)\) continue/);
  assert.match(script, /const retiredRoleIds = new Set/);
  assert.match(script, /const retiredUserIds = new Set/);
  assert.match(script, /UPDATE iam_user_app SET status = 0 WHERE user_id = \? AND app_code = 'kjqb_client'/);
  assert.match(script, /UPDATE iam_role SET status = 0 WHERE app_code = 'kjqb_client' AND role_code = 'region_leader'/);
  const retireIndex = script.indexOf('const retiredRoleIds');
  assert.ok(retireIndex > script.indexOf('await upsertUserAccess(target, data, userByUsername, maps)'));
  assert.ok(retireIndex < script.indexOf('await target.commit()'));
});
