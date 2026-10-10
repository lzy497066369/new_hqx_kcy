const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');

const databaseConfigured = Boolean(process.env.IAM_DB_DATABASE);
const port = 31_015;
const baseUrl = `http://127.0.0.1:${port}`;

test('records IAM administration login events in the audit table', { skip: !databaseConfigured }, async (t) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const username = `audit_bootstrap_${suffix}`;
  const server = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: { ...process.env, IAM_BOOTSTRAP_PASSWORD: 'AuditPassword1!', IAM_BOOTSTRAP_USERNAME: username, PORT: String(port) },
    stdio: 'ignore',
  });
  t.after(() => server.kill());
  t.after(async () => {
    const db = await mysql.createConnection({ database: process.env.IAM_DB_DATABASE, host: process.env.IAM_DB_HOST ?? '127.0.0.1', password: process.env.IAM_DB_PASSWORD, port: Number(process.env.IAM_DB_PORT ?? 3306), user: process.env.IAM_DB_USERNAME ?? 'root' });
    try { await db.execute('DELETE FROM iam_audit_event WHERE username = ?', [username]); } finally { await db.end(); }
  });
  for (let attempt = 0; attempt < 50; attempt += 1) { try { if ((await fetch(`${baseUrl}/health`)).ok) break; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }

  const login = await fetch(`${baseUrl}/auth/login`, { body: JSON.stringify({ password: 'AuditPassword1!', username }), headers: { 'content-type': 'application/json' }, method: 'POST' });
  assert.equal(login.status, 201);
  const loginBody = await login.json();
  const listed = await fetch(`${baseUrl}/iam/admin/audit/events?username=${username}&outcome=success&page=1&limit=20`, {
    headers: { authorization: `Bearer ${loginBody.accessToken}` },
  });
  assert.equal(listed.status, 200);
  const events = await listed.json();
  assert.equal(events.limit, 20);
  assert.equal(events.page, 1);
  assert.ok(events.total >= 1);
  assert.ok(events.items.some((event) => event.action === 'iam.admin.login' && event.username === username));
  const db = await mysql.createConnection({ database: process.env.IAM_DB_DATABASE, host: process.env.IAM_DB_HOST ?? '127.0.0.1', password: process.env.IAM_DB_PASSWORD, port: Number(process.env.IAM_DB_PORT ?? 3306), user: process.env.IAM_DB_USERNAME ?? 'root' });
  try {
    const [rows] = await db.execute('SELECT action, outcome FROM iam_audit_event WHERE username = ? ORDER BY id DESC LIMIT 1', [username]);
    assert.deepEqual(rows[0], { action: 'iam.admin.login', outcome: 'success' });
  } finally { await db.end(); }
});
