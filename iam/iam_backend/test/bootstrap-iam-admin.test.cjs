const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const mysql = require('mysql2/promise');

const run = promisify(execFile);
const databaseConfigured = Boolean(process.env.IAM_DB_DATABASE);

test('provisions the first IAM administrator idempotently', { skip: !databaseConfigured }, async (t) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const username = `bootstrap_admin_${suffix}`;
  const password = 'BootstrapAdminPassword1!';
  const appCode = 'iam_admin';
  const environment = {
    ...process.env,
    IAM_INITIAL_ADMIN_PASSWORD: password,
    IAM_INITIAL_ADMIN_USERNAME: username,
  };
  let appExisted = false;
  let roleExisted = false;

  t.after(async () => {
    const connection = await mysql.createConnection({ database: process.env.IAM_DB_DATABASE, host: process.env.IAM_DB_HOST ?? '127.0.0.1', password: process.env.IAM_DB_PASSWORD, port: Number(process.env.IAM_DB_PORT ?? 3306), user: process.env.IAM_DB_USERNAME ?? 'root' });
    try {
      const [users] = await connection.execute('SELECT id FROM iam_user WHERE username = ?', [username]);
      if (users[0]) {
        await connection.execute('DELETE FROM iam_user_role WHERE user_id = ?', [users[0].id]);
        await connection.execute('DELETE FROM iam_user_app WHERE user_id = ?', [users[0].id]);
        await connection.execute('DELETE FROM iam_user WHERE id = ?', [users[0].id]);
      }
      if (!roleExisted) await connection.execute('DELETE FROM iam_role WHERE app_code = ? AND role_code = ?', [appCode, 'super_admin']);
      if (!appExisted) await connection.execute('DELETE FROM iam_app WHERE app_code = ?', [appCode]);
    } finally { await connection.end(); }
  });

  const before = await mysql.createConnection({ database: process.env.IAM_DB_DATABASE, host: process.env.IAM_DB_HOST ?? '127.0.0.1', password: process.env.IAM_DB_PASSWORD, port: Number(process.env.IAM_DB_PORT ?? 3306), user: process.env.IAM_DB_USERNAME ?? 'root' });
  try {
    const [apps] = await before.execute('SELECT 1 FROM iam_app WHERE app_code = ? LIMIT 1', [appCode]);
    const [roles] = await before.execute('SELECT 1 FROM iam_role WHERE app_code = ? AND role_code = ? LIMIT 1', [appCode, 'super_admin']);
    appExisted = Boolean(apps[0]);
    roleExisted = Boolean(roles[0]);
  } finally { await before.end(); }

  await run(process.execPath, ['scripts/bootstrap-iam-admin.cjs'], { cwd: process.cwd(), env: environment });
  await run(process.execPath, ['scripts/bootstrap-iam-admin.cjs'], { cwd: process.cwd(), env: environment });

  const connection = await mysql.createConnection({ database: process.env.IAM_DB_DATABASE, host: process.env.IAM_DB_HOST ?? '127.0.0.1', password: process.env.IAM_DB_PASSWORD, port: Number(process.env.IAM_DB_PORT ?? 3306), user: process.env.IAM_DB_USERNAME ?? 'root' });
  try {
    const [rows] = await connection.execute(
      `SELECT u.password_hash, r.role_code
       FROM iam_user u
       JOIN iam_user_app ua ON ua.user_id = u.id AND ua.app_code = ? AND ua.status = 1
       JOIN iam_user_role ur ON ur.user_id = u.id AND ur.app_code = ?
       JOIN iam_role r ON r.id = ur.role_id AND r.app_code = ?
       WHERE u.username = ?`,
      [appCode, appCode, appCode, username],
    );
    assert.deepEqual(rows.map((row) => row.role_code), ['super_admin']);
    assert.match(rows[0].password_hash, /^scrypt\$/);
  } finally { await connection.end(); }
});
