const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');

const databaseConfigured = Boolean(process.env.IAM_DB_DATABASE);
const firstPort = 31_022;

async function waitForHealth(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('iam_backend did not start in time');
}

test('persists IAM administrator sessions across backend processes', { skip: !databaseConfigured }, async (t) => {
  const username = `persist_admin_${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const password = 'PersistAdminPassword1!';
  const environment = { ...process.env, IAM_BOOTSTRAP_PASSWORD: password, IAM_BOOTSTRAP_USERNAME: username };
  let first = spawn(process.execPath, ['dist/main.js'], { cwd: process.cwd(), env: { ...environment, PORT: String(firstPort) }, stdio: 'ignore' });
  let second;
  t.after(() => { first?.kill(); second?.kill(); });
  t.after(async () => {
    const db = await mysql.createConnection({ database: process.env.IAM_DB_DATABASE, host: process.env.IAM_DB_HOST ?? '127.0.0.1', password: process.env.IAM_DB_PASSWORD, port: Number(process.env.IAM_DB_PORT ?? 3306), user: process.env.IAM_DB_USERNAME ?? 'root' });
    try { await db.execute('DELETE FROM iam_admin_session WHERE username = ?', [username]); } finally { await db.end(); }
  });

  await waitForHealth(firstPort);
  const login = await fetch(`http://127.0.0.1:${firstPort}/auth/login`, { body: JSON.stringify({ password, username }), headers: { 'content-type': 'application/json' }, method: 'POST' });
  assert.equal(login.status, 201);
  const { accessToken } = await login.json();
  first.kill();
  await new Promise((resolve) => setTimeout(resolve, 200));

  const secondPort = firstPort + 1;
  second = spawn(process.execPath, ['dist/main.js'], { cwd: process.cwd(), env: { ...environment, PORT: String(secondPort) }, stdio: 'ignore' });
  await waitForHealth(secondPort);
  const info = await fetch(`http://127.0.0.1:${secondPort}/user/info`, { headers: { authorization: `Bearer ${accessToken}` } });
  assert.equal(info.status, 200);
  assert.equal((await info.json()).username, username);
});
