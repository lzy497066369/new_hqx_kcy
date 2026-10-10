const { createHash, randomBytes } = require('node:crypto');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');

const databaseConfigured = Boolean(process.env.IAM_DB_DATABASE);
const port = 31_029;
const baseUrl = `http://127.0.0.1:${port}`;
let created;
let server;

const challenge = (value) => createHash('sha256').update(value).digest('base64url');

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(`${baseUrl}/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('iam_backend did not start in time');
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers ?? {}) } });
  const body = response.status === 204 ? null : await response.json();
  return { body, response };
}

async function adminRequest(path, accessToken, options = {}) {
  const result = await request(path, { ...options, headers: { authorization: `Bearer ${accessToken}`, ...(options.headers ?? {}) } });
  assert.ok(result.response.ok, `${options.method ?? 'GET'} ${path} failed: ${JSON.stringify(result.body)}`);
  return result.body;
}

test('expands an all-company scope and persists a default company outside the assigned company', { skip: !databaseConfigured }, async (t) => {
  t.after(() => server?.kill());
  t.after(async () => {
    if (!created) return;
    const db = await mysql.createConnection({ database: process.env.IAM_DB_DATABASE, host: process.env.IAM_DB_HOST ?? '127.0.0.1', password: process.env.IAM_DB_PASSWORD, port: Number(process.env.IAM_DB_PORT ?? 3306), user: process.env.IAM_DB_USERNAME ?? 'root' });
    try {
      await db.execute('DELETE FROM iam_user_app_context WHERE user_id = ? AND app_code = ?', [created.userId, created.appCode]);
      await db.execute('DELETE FROM iam_refresh_token WHERE user_id = ?', [created.userId]);
      await db.execute('DELETE FROM iam_oauth_authorization_code WHERE user_id = ?', [created.userId]);
      await db.execute('DELETE FROM iam_sso_session WHERE user_id = ?', [created.userId]);
      await db.execute('DELETE FROM iam_user_company_scope WHERE user_id = ?', [created.userId]);
      await db.execute('DELETE FROM iam_company_member WHERE user_id = ?', [created.userId]);
      await db.execute('DELETE FROM iam_user_app WHERE user_id = ?', [created.userId]);
      await db.execute('DELETE FROM iam_oauth_client WHERE app_code = ?', [created.appCode]);
      await db.execute('DELETE FROM iam_company WHERE id IN (?, ?)', [created.assignedCompanyId, created.unassignedCompanyId]);
      await db.execute('DELETE FROM iam_user WHERE id = ?', [created.userId]);
      await db.execute('DELETE FROM iam_app WHERE id = ?', [created.appId]);
    } finally { await db.end(); }
  });

  server = spawn(process.execPath, ['dist/main.js'], { cwd: process.cwd(), env: { ...process.env, IAM_BOOTSTRAP_PASSWORD: 'ChangeMe123!', IAM_BOOTSTRAP_USERNAME: 'iam_admin', PORT: String(port) }, stdio: 'ignore' });
  await waitForHealth();
  const login = await request('/auth/login', { body: JSON.stringify({ password: 'ChangeMe123!', username: 'iam_admin' }), method: 'POST' });
  const adminToken = login.body.accessToken;
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const appCode = `all_scope_${suffix}`;
  const clientId = `all_scope_client_${suffix}`;
  const app = await adminRequest('/iam/admin/apps', adminToken, { body: JSON.stringify({ appCode, appName: 'All scope app', companySourceSystem: 'all_scope_test' }), method: 'POST' });
  const user = await adminRequest('/iam/admin/users', adminToken, { body: JSON.stringify({ password: 'StrongPassword1!', realName: 'All scope user', username: `all_scope_user_${suffix}` }), method: 'POST' });
  const assignedCompany = await adminRequest('/iam/admin/companies', adminToken, { body: JSON.stringify({ companyName: `All scope assigned ${suffix}`, sourceCompanyId: `assigned-${suffix}`, sourceSystem: 'all_scope_test' }), method: 'POST' });
  const unassignedCompany = await adminRequest('/iam/admin/companies', adminToken, { body: JSON.stringify({ companyName: `All scope unassigned ${suffix}`, sourceCompanyId: `unassigned-${suffix}`, sourceSystem: 'all_scope_test' }), method: 'POST' });
  created = { appCode, appId: app.id, assignedCompanyId: assignedCompany.id, unassignedCompanyId: unassignedCompany.id, userId: user.id };

  await adminRequest(`/iam/admin/users/${user.id}/apps/${appCode}`, adminToken, { body: JSON.stringify({ status: 1 }), method: 'PUT' });
  await adminRequest(`/iam/admin/companies/${assignedCompany.id}/members`, adminToken, { body: JSON.stringify({ appCode, dataScope: 'all', isDefault: true, isPrimary: false, memberType: 'employee', userId: user.id }), method: 'PUT' });
  await adminRequest(`/iam/admin/apps/${appCode}/clients`, adminToken, { body: JSON.stringify({ clientId, clientType: 'public', grantTypes: ['authorization_code', 'refresh_token'], redirectUris: ['https://all-scope.example.test/callback'] }), method: 'POST' });

  const session = await request('/oauth/session', { body: JSON.stringify({ password: 'StrongPassword1!', username: user.username }), method: 'POST' });
  const verifier = randomBytes(48).toString('base64url');
  const authorize = await fetch(`${baseUrl}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent('https://all-scope.example.test/callback')}&code_challenge=${challenge(verifier)}&code_challenge_method=S256`, { headers: { cookie: session.response.headers.get('set-cookie') }, redirect: 'manual' });
  const code = new URL(authorize.headers.get('location')).searchParams.get('code');
  const token = await request('/oauth/token', { body: JSON.stringify({ client_id: clientId, code, code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: 'https://all-scope.example.test/callback' }), method: 'POST' });
  const headers = { authorization: `Bearer ${token.body.access_token}` };
  const initial = await request(`/iam/me/apps/${appCode}/companies`, { headers });
  assert.equal(initial.response.status, 200, JSON.stringify(initial.body));
  assert.ok(Array.isArray(initial.body), JSON.stringify(initial.body));
  assert.ok(initial.body.length >= 2);
  assert.ok(initial.body.every((item) => item.sourceSystem === 'all_scope_test'));
  assert.deepEqual(initial.body.filter((item) => [assignedCompany.id, unassignedCompany.id].includes(item.id)).map((item) => ({ dataScope: item.dataScope, id: item.id, isDefault: item.isDefault })), [
    { dataScope: 'all', id: assignedCompany.id, isDefault: true },
    { dataScope: 'all', id: unassignedCompany.id, isDefault: false },
  ].sort((left, right) => Number(left.id) - Number(right.id)));
  const switched = await request(`/iam/me/apps/${appCode}/companies/${unassignedCompany.id}/default`, { headers, method: 'PUT' });
  assert.equal(switched.response.status, 200);
  assert.deepEqual(switched.body.filter((item) => item.isDefault).map((item) => item.id), [unassignedCompany.id]);
  const persisted = await request(`/iam/me/apps/${appCode}/companies`, { headers });
  assert.deepEqual(persisted.body.filter((item) => item.isDefault).map((item) => item.id), [unassignedCompany.id]);
});
