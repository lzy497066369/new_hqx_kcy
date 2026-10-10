const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');

const databaseConfigured = Boolean(process.env.IAM_DB_DATABASE);
const port = 31_002;
const baseUrl = `http://127.0.0.1:${port}`;
let server;
let created;

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // The Nest process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('iam_backend did not start in time');
}

async function request(path, accessToken, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const body = response.status === 204 ? null : await response.json();
  assert.ok(response.ok, `${options.method ?? 'GET'} ${path} failed: ${JSON.stringify(body)}`);
  return body;
}

test('persists apps, users, companies and company owners for IAM administration', { skip: !databaseConfigured }, async (t) => {
  t.after(() => server?.kill());
  t.after(async () => {
    if (!created) return;
    const connection = await mysql.createConnection({
      database: process.env.IAM_DB_DATABASE,
      host: process.env.IAM_DB_HOST ?? '127.0.0.1',
      password: process.env.IAM_DB_PASSWORD,
      port: Number(process.env.IAM_DB_PORT ?? 3306),
      user: process.env.IAM_DB_USERNAME ?? 'root',
    });
    try {
      await connection.execute('DELETE FROM iam_user_company_scope WHERE company_id = ? AND user_id = ?', [created.company.id, created.user.id]);
      await connection.execute('DELETE FROM iam_company_member WHERE company_id = ? AND user_id = ?', [created.company.id, created.user.id]);
      await connection.execute('DELETE FROM iam_company WHERE id = ?', [created.company.id]);
      await connection.execute('DELETE FROM iam_user WHERE id = ?', [created.user.id]);
      await connection.execute('DELETE FROM iam_app WHERE id = ?', [created.app.id]);
    } finally {
      await connection.end();
    }
  });
  server = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      IAM_BOOTSTRAP_PASSWORD: 'ChangeMe123!',
      IAM_BOOTSTRAP_USERNAME: 'iam_admin',
      PORT: String(port),
    },
    stdio: 'ignore',
  });
  await waitForHealth();

  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    body: JSON.stringify({ password: 'ChangeMe123!', username: 'iam_admin' }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  const { accessToken } = await loginResponse.json();
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const app = await request('/iam/admin/apps', accessToken, {
    body: JSON.stringify({
      appCode: `m1_${suffix}`,
      appName: 'M1 application',
      appType: 'web',
      homePath: '/home',
      portalType: 'admin',
    }),
    method: 'POST',
  });
  assert.equal(app.appCode, `m1_${suffix}`);

  const user = await request('/iam/admin/users', accessToken, {
    body: JSON.stringify({
      password: 'StrongPassword1!',
      realName: 'M1 user',
      username: `m1_user_${suffix}`,
    }),
    method: 'POST',
  });
  assert.equal(user.username, `m1_user_${suffix}`);
  assert.equal('passwordHash' in user, false);

  const company = await request('/iam/admin/companies', accessToken, {
    body: JSON.stringify({
      companyName: `M1 company ${suffix}`,
      creditCode: `M1${suffix}`,
      contactName: 'M1 contact',
      contactPhone: '13800000000',
    }),
    method: 'POST',
  });
  assert.equal(company.companyName, `M1 company ${suffix}`);

  created = { app, company, user };
  const member = await request(`/iam/admin/companies/${company.id}/members`, accessToken, {
    body: JSON.stringify({
      appCode: app.appCode,
      dataScope: 'all',
      isDefault: true,
      isPrimary: true,
      memberType: 'owner',
      userId: user.id,
    }),
    method: 'PUT',
  });
  assert.equal(member.memberType, 'owner');
  assert.equal(member.userId, user.id);

  const disabledMember = await request(`/iam/admin/companies/${company.id}/members`, accessToken, {
    body: JSON.stringify({
      appCode: app.appCode,
      dataScope: 'all',
      isDefault: false,
      isPrimary: false,
      memberType: 'owner',
      status: 0,
      userId: user.id,
    }),
    method: 'PUT',
  });
  assert.equal(disabledMember.status, 0);

  const members = await request(`/iam/admin/companies/${company.id}/members`, accessToken);
  assert.equal(members.items.length, 1);
  assert.equal(members.items[0].username, user.username);
  assert.equal(members.items[0].status, 0);
});
