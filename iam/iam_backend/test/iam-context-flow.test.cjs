const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');

const databaseConfigured = Boolean(process.env.IAM_DB_DATABASE);
const port = 31_006;
const baseUrl = `http://127.0.0.1:${port}`;
let created;
let server;

const challenge = (verifier) => createHash('sha256').update(verifier).digest('base64url');

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(`${baseUrl}/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('iam_backend did not start in time');
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = response.status === 204 ? null : await response.json();
  assert.ok(response.ok, `${options.method ?? 'GET'} ${path} failed: ${JSON.stringify(body)}`);
  return { body, response };
}

test('builds user application context from roles, permissions, menus and company scope', { skip: !databaseConfigured }, async (t) => {
  t.after(() => server?.kill());
  t.after(async () => {
    if (!created) return;
    const db = await mysql.createConnection({ database: process.env.IAM_DB_DATABASE, host: process.env.IAM_DB_HOST ?? '127.0.0.1', password: process.env.IAM_DB_PASSWORD, port: Number(process.env.IAM_DB_PORT ?? 3306), user: process.env.IAM_DB_USERNAME ?? 'root' });
    try {
      await db.execute('DELETE FROM iam_refresh_token WHERE user_id = ?', [created.userId]); await db.execute('DELETE FROM iam_oauth_authorization_code WHERE user_id = ?', [created.userId]); await db.execute('DELETE FROM iam_sso_session WHERE user_id = ?', [created.userId]);
      await db.execute('DELETE FROM iam_user_company_scope WHERE user_id = ?', [created.userId]); await db.execute('DELETE FROM iam_company_member WHERE user_id = ?', [created.userId]); await db.execute('DELETE FROM iam_user_role WHERE user_id = ?', [created.userId]); await db.execute('DELETE FROM iam_user_app WHERE user_id = ?', [created.userId]);
      await db.execute('DELETE FROM iam_role_permission WHERE role_id IN (SELECT id FROM iam_role WHERE app_code = ?)', [created.appCode]); await db.execute('DELETE FROM iam_role WHERE app_code = ?', [created.appCode]); await db.execute('DELETE FROM iam_permission WHERE app_code = ?', [created.appCode]); await db.execute('DELETE FROM iam_menu WHERE app_code = ?', [created.appCode]); await db.execute('DELETE FROM iam_oauth_client WHERE app_code = ?', [created.appCode]);
      await db.execute('DELETE FROM iam_company WHERE id IN (?, ?)', [created.companyId, created.secondCompanyId]); await db.execute('DELETE FROM iam_user WHERE id = ?', [created.userId]); await db.execute('DELETE FROM iam_app WHERE id = ?', [created.appId]);
    } finally { await db.end(); }
  });
  server = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: { ...process.env, IAM_BOOTSTRAP_PASSWORD: 'ChangeMe123!', IAM_BOOTSTRAP_USERNAME: 'iam_admin', PORT: String(port) },
    stdio: 'ignore',
  });
  await waitForHealth();
  const bootstrap = await request('/auth/login', { body: JSON.stringify({ password: 'ChangeMe123!', username: 'iam_admin' }), method: 'POST' });
  const adminHeaders = { authorization: `Bearer ${bootstrap.body.accessToken}` };
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const appCode = `ctx_${suffix}`;
  const clientId = `ctx_client_${suffix}`;
  const username = `ctx_user_${suffix}`;

  const app = await request('/iam/admin/apps', { body: JSON.stringify({ appCode, appName: 'Context app' }), headers: adminHeaders, method: 'POST' });
  const user = await request('/iam/admin/users', { body: JSON.stringify({ password: 'StrongPassword1!', realName: 'Context user', username }), headers: adminHeaders, method: 'POST' });
  const company = await request('/iam/admin/companies', { body: JSON.stringify({ companyName: `Context company ${suffix}`, sourceCompanyId: `source-${suffix}`, sourceSystem: 'context_test' }), headers: adminHeaders, method: 'POST' });
  const secondCompany = await request('/iam/admin/companies', { body: JSON.stringify({ companyName: `Context company two ${suffix}`, sourceCompanyId: `source-two-${suffix}`, sourceSystem: 'context_test' }), headers: adminHeaders, method: 'POST' });
  created = { appCode, appId: app.body.id, companyId: company.body.id, secondCompanyId: secondCompany.body.id, userId: user.body.id };

  await request(`/iam/admin/users/${user.body.id}/apps/${appCode}`, { body: JSON.stringify({ homePath: '/context-home', status: 1 }), headers: adminHeaders, method: 'PUT' });
  await request(`/iam/admin/apps/${appCode}/clients`, { body: JSON.stringify({ clientId, clientType: 'public', grantTypes: ['authorization_code', 'refresh_token'], redirectUris: ['https://context.example.test/callback'] }), headers: adminHeaders, method: 'POST' });
  const permission = await request(`/iam/admin/apps/${appCode}/permissions`, { body: JSON.stringify({ permissionCode: 'Context:Read', permissionName: 'Context read' }), headers: adminHeaders, method: 'POST' });
  const role = await request(`/iam/admin/apps/${appCode}/roles`, { body: JSON.stringify({ roleCode: 'context_reader', roleName: 'Context reader' }), headers: adminHeaders, method: 'POST' });
  const parentMenu = await request(`/iam/admin/apps/${appCode}/menus`, { body: JSON.stringify({ authCode: 'Context:Parent:Read', menuName: 'Context parent', menuType: 'catalog', path: '/context', sortOrder: 1 }), headers: adminHeaders, method: 'POST' });
  const menu = await request(`/iam/admin/apps/${appCode}/menus`, { body: JSON.stringify({ authCode: 'Context:Read', component: 'context/index', menuName: 'Context', menuType: 'menu', parentId: parentMenu.body.id, path: '/context/index', sortOrder: 2 }), headers: adminHeaders, method: 'POST' });
  await request(`/iam/admin/apps/${appCode}/roles/${role.body.id}/permissions`, { body: JSON.stringify({ permissionIds: [permission.body.id] }), headers: adminHeaders, method: 'PUT' });
  const rolePermissions = await request(`/iam/admin/apps/${appCode}/roles/${role.body.id}/permissions`, { headers: adminHeaders });
  assert.deepEqual(rolePermissions.body, { permissionIds: [permission.body.id] });
  await request(`/iam/admin/users/${user.body.id}/apps/${appCode}/roles`, { body: JSON.stringify({ roleIds: [role.body.id] }), headers: adminHeaders, method: 'PUT' });
  const assignedRoles = await request(`/iam/admin/users/${user.body.id}/apps/${appCode}/roles`, { headers: adminHeaders });
  assert.deepEqual(assignedRoles.body, { roleIds: [role.body.id] });
  await request(`/iam/admin/companies/${company.body.id}/members`, { body: JSON.stringify({ appCode, dataScope: 'assigned', isDefault: true, isPrimary: true, memberType: 'owner', userId: user.body.id }), headers: adminHeaders, method: 'PUT' });
  await request(`/iam/admin/companies/${secondCompany.body.id}/members`, { body: JSON.stringify({ appCode, dataScope: 'assigned', isDefault: false, isPrimary: false, memberType: 'employee', userId: user.body.id }), headers: adminHeaders, method: 'PUT' });

  const session = await request('/oauth/session', { body: JSON.stringify({ password: 'StrongPassword1!', username }), method: 'POST' });
  const verifier = randomBytes(48).toString('base64url');
  const authorize = await fetch(`${baseUrl}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent('https://context.example.test/callback')}&code_challenge=${challenge(verifier)}&code_challenge_method=S256`, { headers: { cookie: session.response.headers.get('set-cookie') }, redirect: 'manual' });
  const code = new URL(authorize.headers.get('location')).searchParams.get('code');
  const token = await request('/oauth/token', { body: JSON.stringify({ client_id: clientId, code, code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: 'https://context.example.test/callback' }), method: 'POST' });
  const claims = JSON.parse(Buffer.from(token.body.access_token.split('.')[1], 'base64url').toString('utf8'));
  assert.deepEqual(claims.permissions, ['Context:Read']);
  assert.deepEqual(claims.roles, ['context_reader']);
  assert.equal(claims.home_path, '/context-home');
  const authHeaders = { authorization: `Bearer ${token.body.access_token}` };

  const me = await request('/iam/me', { headers: authHeaders });
  assert.deepEqual(me.body, { avatar: null, email: null, id: user.body.id, phone: null, realName: 'Context user', username });
  const permissions = await request(`/iam/me/apps/${appCode}/permissions`, { headers: authHeaders });
  assert.deepEqual(permissions.body, ['Context:Read']);
  const menus = await request(`/iam/me/apps/${appCode}/menus`, { headers: authHeaders });
  assert.deepEqual(menus.body, [{ authCode: 'Context:Parent:Read', id: parentMenu.body.id, meta: { order: 1, title: 'Context parent' }, name: 'Context parent', path: '/context', status: 1, type: 'catalog', children: [{ authCode: 'Context:Read', component: 'context/index', id: menu.body.id, meta: { order: 2, title: 'Context' }, name: 'Context', path: '/context/index', status: 1, type: 'menu' }] }]);
  const switchedCompanies = await request(`/iam/me/apps/${appCode}/companies/${secondCompany.body.id}/default`, { headers: authHeaders, method: 'PUT' });
  assert.deepEqual(switchedCompanies.body.map((item) => ({ id: item.id, isDefault: item.isDefault })), [{ id: company.body.id, isDefault: false }, { id: secondCompany.body.id, isDefault: true }]);
  const companies = await request(`/iam/me/apps/${appCode}/companies`, { headers: authHeaders });
  assert.deepEqual(companies.body.map((item) => ({ id: item.id, isDefault: item.isDefault })), [{ id: company.body.id, isDefault: false }, { id: secondCompany.body.id, isDefault: true }]);
});
