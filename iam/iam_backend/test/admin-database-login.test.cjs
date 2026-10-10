const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');

const databaseConfigured = Boolean(process.env.IAM_DB_DATABASE);
const port = 31_007;
const baseUrl = `http://127.0.0.1:${port}`;
let created;
let server;

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {
      // The Nest process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('iam_backend did not start in time');
}

test('authenticates a database super administrator for IAM management', { skip: !databaseConfigured }, async (t) => {
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
      await connection.execute('DELETE FROM iam_user_role WHERE user_id = ?', [created.userId]);
      await connection.execute('DELETE FROM iam_user_app WHERE user_id = ?', [created.userId]);
      await connection.execute('DELETE FROM iam_role WHERE id = ?', [created.businessRoleId]);
      await connection.execute('DELETE FROM iam_user WHERE id = ?', [created.userId]);
    } finally {
      await connection.end();
    }
  });

  server = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });
  await waitForHealth();

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const username = `iam_admin_${suffix}`;
  const password = 'DatabaseAdminPassword1!';
  const connection = await mysql.createConnection({
    database: process.env.IAM_DB_DATABASE,
    host: process.env.IAM_DB_HOST ?? '127.0.0.1',
    password: process.env.IAM_DB_PASSWORD,
    port: Number(process.env.IAM_DB_PORT ?? 3306),
    user: process.env.IAM_DB_USERNAME ?? 'root',
  });
  try {
    const [userResult] = await connection.execute(
      'INSERT INTO iam_user (username, password_hash, real_name, status, created_at, updated_at) VALUES (?, ?, ?, 1, NOW(), NOW())',
      [username, password, 'Database IAM Admin'],
    );
    const [roleResult] = await connection.execute(
      'INSERT INTO iam_role (app_code, role_code, role_name, role_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW()) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
      ['iam_admin', 'super_admin', 'Super administrator', 'system'],
    );
    const [businessRoleResult] = await connection.execute(
      'INSERT INTO iam_role (app_code, role_code, role_name, role_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW())',
      [`business_${suffix}`, 'super_admin', 'Business super administrator', 'system'],
    );
    const userId = String(userResult.insertId);
    const roleId = String(roleResult.insertId);
    const businessRoleId = String(businessRoleResult.insertId);
    await connection.execute(
      'INSERT INTO iam_user_app (user_id, app_code, status, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW())',
      [userId, 'iam_admin'],
    );
    await connection.execute(
      'INSERT INTO iam_user_role (user_id, app_code, role_id, created_at) VALUES (?, ?, ?, NOW())',
      [userId, 'iam_admin', roleId],
    );
    created = { businessRoleId, roleId, userId };
  } finally {
    await connection.end();
  }

  const login = await fetch(`${baseUrl}/auth/login`, {
    body: JSON.stringify({ password, username }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(login.status, 201);
  const { accessToken } = await login.json();

  const apps = await fetch(`${baseUrl}/iam/admin/apps`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  assert.equal(apps.status, 200);

  const verifyConnection = await mysql.createConnection({
    database: process.env.IAM_DB_DATABASE,
    host: process.env.IAM_DB_HOST ?? '127.0.0.1',
    password: process.env.IAM_DB_PASSWORD,
    port: Number(process.env.IAM_DB_PORT ?? 3306),
    user: process.env.IAM_DB_USERNAME ?? 'root',
  });
  try {
    const [rows] = await verifyConnection.execute(
      'SELECT password_hash FROM iam_user WHERE id = ?',
      [created.userId],
    );
    assert.match(rows[0].password_hash, /^scrypt\$/);
  } finally {
    await verifyConnection.end();
  }
});

test('does not treat a business application super_admin role as IAM administration access', { skip: !databaseConfigured }, async (t) => {
  t.after(() => server?.kill());
  t.after(async () => {
    if (!created) return;
    const connection = await mysql.createConnection({ database: process.env.IAM_DB_DATABASE, host: process.env.IAM_DB_HOST ?? '127.0.0.1', password: process.env.IAM_DB_PASSWORD, port: Number(process.env.IAM_DB_PORT ?? 3306), user: process.env.IAM_DB_USERNAME ?? 'root' });
    try {
      await connection.execute('DELETE FROM iam_user_role WHERE user_id = ?', [created.userId]);
      await connection.execute('DELETE FROM iam_user_app WHERE user_id = ?', [created.userId]);
      await connection.execute('DELETE FROM iam_role WHERE id = ?', [created.roleId]);
      await connection.execute('DELETE FROM iam_user WHERE id = ?', [created.userId]);
    } finally { await connection.end(); }
  });
  server = spawn(process.execPath, ['dist/main.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port + 1) }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port + 1}`;
  for (let attempt = 0; attempt < 50; attempt += 1) { try { if ((await fetch(`${base}/health`)).ok) break; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const username = `business_admin_${suffix}`;
  const password = 'BusinessAdminPassword1!';
  const connection = await mysql.createConnection({ database: process.env.IAM_DB_DATABASE, host: process.env.IAM_DB_HOST ?? '127.0.0.1', password: process.env.IAM_DB_PASSWORD, port: Number(process.env.IAM_DB_PORT ?? 3306), user: process.env.IAM_DB_USERNAME ?? 'root' });
  try {
    const [userResult] = await connection.execute('INSERT INTO iam_user (username, password_hash, real_name, status, created_at, updated_at) VALUES (?, ?, ?, 1, NOW(), NOW())', [username, password, 'Business Admin']);
    const [roleResult] = await connection.execute('INSERT INTO iam_role (app_code, role_code, role_name, role_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW())', [`business_${suffix}`, 'super_admin', 'Business super administrator', 'system']);
    const userId = String(userResult.insertId);
    const roleId = String(roleResult.insertId);
    await connection.execute('INSERT INTO iam_user_app (user_id, app_code, status, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW())', [userId, `business_${suffix}`]);
    await connection.execute('INSERT INTO iam_user_role (user_id, app_code, role_id, created_at) VALUES (?, ?, ?, NOW())', [userId, `business_${suffix}`, roleId]);
    created = { roleId, userId };
  } finally { await connection.end(); }
  const login = await fetch(`${base}/auth/login`, { body: JSON.stringify({ password, username }), headers: { 'content-type': 'application/json' }, method: 'POST' });
  assert.equal(login.status, 401);
});
