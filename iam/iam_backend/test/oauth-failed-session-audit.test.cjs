const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');

const databaseConfigured = Boolean(process.env.IAM_DB_DATABASE);
const port = 31_021;
const baseUrl = `http://127.0.0.1:${port}`;

test('records failed SSO password attempts without sensitive request data', { skip: !databaseConfigured }, async (t) => {
  const username = `failed_sso_${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const server = spawn(process.execPath, ['dist/main.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  t.after(() => server.kill());
  t.after(async () => {
    const db = await mysql.createConnection({ database: process.env.IAM_DB_DATABASE, host: process.env.IAM_DB_HOST ?? '127.0.0.1', password: process.env.IAM_DB_PASSWORD, port: Number(process.env.IAM_DB_PORT ?? 3306), user: process.env.IAM_DB_USERNAME ?? 'root' });
    try { await db.execute('DELETE FROM iam_audit_event WHERE username = ?', [username]); } finally { await db.end(); }
  });
  for (let attempt = 0; attempt < 50; attempt += 1) { try { if ((await fetch(`${baseUrl}/health`)).ok) break; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }

  const response = await fetch(`${baseUrl}/oauth/session`, { body: JSON.stringify({ password: 'WrongPassword1!', username }), headers: { 'content-type': 'application/json' }, method: 'POST' });
  assert.equal(response.status, 401);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const rejected = await fetch(`${baseUrl}/oauth/session`, { body: JSON.stringify({ password: 'WrongPassword1!', username }), headers: { 'content-type': 'application/json' }, method: 'POST' });
    assert.equal(rejected.status, 401);
  }
  const throttled = await fetch(`${baseUrl}/oauth/session`, { body: JSON.stringify({ password: 'WrongPassword1!', username }), headers: { 'content-type': 'application/json' }, method: 'POST' });
  assert.equal(throttled.status, 429);

  const db = await mysql.createConnection({ database: process.env.IAM_DB_DATABASE, host: process.env.IAM_DB_HOST ?? '127.0.0.1', password: process.env.IAM_DB_PASSWORD, port: Number(process.env.IAM_DB_PORT ?? 3306), user: process.env.IAM_DB_USERNAME ?? 'root' });
  try {
    const [rows] = await db.execute('SELECT action, details, outcome, username FROM iam_audit_event WHERE username = ? ORDER BY id DESC LIMIT 1', [username]);
    assert.deepEqual(rows[0], { action: 'oauth.session.created', details: null, outcome: 'failure', username });
  } finally { await db.end(); }
});
