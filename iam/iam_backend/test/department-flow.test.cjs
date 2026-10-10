const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');

const databaseConfigured = Boolean(process.env.IAM_DB_DATABASE);
const port = 31_027;
const baseUrl = `http://127.0.0.1:${port}`;
let created;
let server;

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
  return { body: response.status === 204 ? null : await response.json(), response };
}

async function adminRequest(path, accessToken, options = {}) {
  const result = await request(path, {
    ...options,
    headers: { authorization: `Bearer ${accessToken}`, ...(options.headers ?? {}) },
  });
  assert.ok(result.response.ok, `${options.method ?? 'GET'} ${path} failed: ${JSON.stringify(result.body)}`);
  return result.body;
}

test('manages the platform department tree and one primary department per user', { skip: !databaseConfigured }, async (t) => {
  t.after(() => server?.kill());
  t.after(async () => {
    if (!created) return;
    const db = await mysql.createConnection({
      database: process.env.IAM_DB_DATABASE,
      host: process.env.IAM_DB_HOST ?? '127.0.0.1',
      password: process.env.IAM_DB_PASSWORD,
      port: Number(process.env.IAM_DB_PORT ?? 3306),
      user: process.env.IAM_DB_USERNAME ?? 'root',
    });
    try {
      await db.execute('DELETE FROM iam_user_platform_department WHERE department_id IN (?, ?)', [created.rootId, created.childId]);
      await db.execute('DELETE FROM iam_platform_department WHERE id IN (?, ?)', [created.rootId, created.childId]);
      await db.execute('DELETE FROM iam_user WHERE id IN (?, ?)', [created.firstUserId, created.secondUserId]);
    } finally { await db.end(); }
  });

  server = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: { ...process.env, IAM_BOOTSTRAP_PASSWORD: 'ChangeMe123!', IAM_BOOTSTRAP_USERNAME: 'iam_admin', PORT: String(port) },
    stdio: 'ignore',
  });
  await waitForHealth();

  const login = await request('/auth/login', {
    body: JSON.stringify({ password: 'ChangeMe123!', username: 'iam_admin' }),
    method: 'POST',
  });
  assert.equal(login.response.status, 201);
  const adminToken = login.body.accessToken;
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const firstUser = await adminRequest('/iam/admin/users', adminToken, {
    body: JSON.stringify({ password: 'StrongPassword1!', realName: 'Platform leader', username: `platform_dept_user_${suffix}` }),
    method: 'POST',
  });
  const secondUser = await adminRequest('/iam/admin/users', adminToken, {
    body: JSON.stringify({ password: 'StrongPassword1!', realName: 'Platform member', username: `platform_dept_member_${suffix}` }),
    method: 'POST',
  });
  const root = await adminRequest('/iam/admin/platform-departments', adminToken, {
    body: JSON.stringify({ deptCode: `root_${suffix}`, deptName: '总部', leaderUserId: firstUser.id, remark: '平台内部组织' }),
    method: 'POST',
  });
  const child = await adminRequest('/iam/admin/platform-departments', adminToken, {
    body: JSON.stringify({ deptCode: `project_${suffix}`, deptName: '项目部', leaderUserId: firstUser.id, parentId: root.id }),
    method: 'POST',
  });
  created = { childId: child.id, firstUserId: firstUser.id, rootId: root.id, secondUserId: secondUser.id };

  const circular = await request(`/iam/admin/platform-departments/${root.id}`, {
    body: JSON.stringify({ deptCode: root.deptCode, deptName: root.deptName, parentId: child.id, status: 1 }),
    headers: { authorization: `Bearer ${adminToken}` },
    method: 'PUT',
  });
  assert.equal(circular.response.status, 400);

  await adminRequest(`/iam/admin/platform-departments/${root.id}/members`, adminToken, {
    body: JSON.stringify({ isPrimary: true, status: 1, userId: secondUser.id }),
    method: 'PUT',
  });
  await adminRequest(`/iam/admin/platform-departments/${child.id}/members`, adminToken, {
    body: JSON.stringify({ isPrimary: true, status: 1, userId: secondUser.id }),
    method: 'PUT',
  });
  const rootMembers = await adminRequest(`/iam/admin/platform-departments/${root.id}/members`, adminToken);
  const childMembers = await adminRequest(`/iam/admin/platform-departments/${child.id}/members`, adminToken);
  assert.equal(rootMembers.items.find((item) => item.userId === secondUser.id).isPrimary, 0);
  assert.equal(childMembers.items.find((item) => item.userId === secondUser.id).isPrimary, 1);

  const departments = await adminRequest('/iam/admin/platform-departments', adminToken);
  assert.deepEqual(
    departments.items.filter((item) => [root.id, child.id].includes(item.id)).map((item) => ({ id: item.id, parentId: item.parentId })),
    [{ id: root.id, parentId: null }, { id: child.id, parentId: root.id }],
  );
});
