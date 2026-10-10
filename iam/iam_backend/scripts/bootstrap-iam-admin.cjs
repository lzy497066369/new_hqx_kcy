const path = require('node:path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const { randomBytes, scrypt: scryptCallback } = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(scryptCallback);
const rootDir = path.resolve(__dirname, '..');
const fallbackEnvPath = path.resolve(rootDir, '..', '..', 'backend', '.env');
dotenv.config({ path: process.env.IAM_ENV_FILE || fallbackEnvPath });

const database = process.env.IAM_DB_DATABASE;
const appCode = 'iam_admin';
const password = process.env.IAM_INITIAL_ADMIN_PASSWORD;
const username = process.env.IAM_INITIAL_ADMIN_USERNAME;
const realName = process.env.IAM_INITIAL_ADMIN_REAL_NAME || 'IAM Administrator';

function required(name, value) {
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

async function hashPassword(value) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(value, salt, 64);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function main() {
  required('IAM_DB_DATABASE', database);
  required('IAM_INITIAL_ADMIN_USERNAME', username);
  required('IAM_INITIAL_ADMIN_PASSWORD', password);
  const connection = await mysql.createConnection({
    database,
    host: process.env.IAM_DB_HOST || process.env.DB_HOST || '127.0.0.1',
    password: process.env.IAM_DB_PASSWORD || process.env.DB_PASSWORD,
    port: Number(process.env.IAM_DB_PORT || process.env.DB_PORT || 3306),
    user: process.env.IAM_DB_USERNAME || process.env.DB_USERNAME || 'root',
  });
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO iam_app (app_code, app_name, app_type, portal_type, home_path, status, remark, created_at, updated_at)
       VALUES (?, 'IAM Administration', 'web', 'admin', '/iam/overview', 1, 'IAM administration application', NOW(), NOW())
       ON DUPLICATE KEY UPDATE app_name = VALUES(app_name), home_path = VALUES(home_path), status = 1, updated_at = NOW()`,
      [appCode],
    );
    await connection.execute(
      `INSERT INTO iam_role (app_code, role_code, role_name, role_type, status, remark, created_at, updated_at)
       VALUES (?, 'super_admin', 'Super administrator', 'system', 1, 'IAM management administrator', NOW(), NOW())
       ON DUPLICATE KEY UPDATE role_name = VALUES(role_name), status = 1, updated_at = NOW()`,
      [appCode],
    );

    const [existingUsers] = await connection.execute(
      'SELECT id FROM iam_user WHERE username = ? LIMIT 1',
      [username],
    );
    let userId;
    if (existingUsers[0]) {
      userId = String(existingUsers[0].id);
    } else {
      const passwordHash = await hashPassword(password);
      const [userResult] = await connection.execute(
        `INSERT INTO iam_user (username, password_hash, real_name, status, password_changed_at, created_at, updated_at)
         VALUES (?, ?, ?, 1, NOW(), NOW(), NOW())`,
        [username, passwordHash, realName],
      );
      userId = String(userResult.insertId);
    }

    const [[role]] = await connection.execute(
      'SELECT id FROM iam_role WHERE app_code = ? AND role_code = ? LIMIT 1',
      [appCode, 'super_admin'],
    );
    await connection.execute(
      `INSERT INTO iam_user_app (user_id, app_code, status, home_path, created_at, updated_at)
       VALUES (?, ?, 1, '/iam/overview', NOW(), NOW())
       ON DUPLICATE KEY UPDATE status = 1, home_path = VALUES(home_path), updated_at = NOW()`,
      [userId, appCode],
    );
    await connection.execute(
      `INSERT INTO iam_user_role (user_id, app_code, role_id, created_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)`,
      [userId, appCode, String(role.id)],
    );
    await connection.commit();
    console.log(`IAM administrator is ready: ${username}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`IAM administrator bootstrap failed: ${error.message}`);
  process.exitCode = 1;
});
