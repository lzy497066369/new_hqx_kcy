#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

function loadEnv(filePath) {
  const result = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index < 1 || line.trim().startsWith('#')) continue;
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function count(connection, sql, params = []) {
  const [[row]] = await connection.query(sql, params);
  return Number(row.count);
}

async function main() {
  const appCode = process.argv[2] ?? 'kjqb';
  const env = { ...loadEnv(path.join(__dirname, '..', '.env')), ...process.env };
  const connection = await mysql.createConnection({
    database: env.DB_DATABASE,
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: Number(env.DB_PORT ?? 3306),
    user: env.DB_USERNAME,
  });

  try {
    const [[app]] = await connection.query(
      'SELECT code, status FROM sys_app WHERE code = ?',
      [appCode],
    );
    assert(app?.status === 1, `The ${appCode} application registration is missing`);

    for (const table of ['sys_role', 'sys_permission', 'sys_menu']) {
      assert(
        (await count(
          connection,
          `SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = '${table}' AND column_name = 'app_code'`,
        )) === 1,
        `${table}.app_code is missing`,
      );
    }

    for (const [table, index] of [
      ['sys_role', 'uk_sys_role_app_portal_code'],
      ['sys_permission', 'uk_sys_permission_app_portal_code'],
      ['sys_menu', 'idx_sys_menu_app_portal_parent'],
    ]) {
      assert(
        (await count(
          connection,
          `SELECT COUNT(*) AS count FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = '${table}' AND index_name = '${index}'`,
        )) > 0,
        `${table}.${index} is missing`,
      );
    }

    const userAppCount = await count(
      connection,
      'SELECT COUNT(*) AS count FROM sys_user_app WHERE app_code = ?',
      [appCode],
    );
    console.log(
      `Auth application scope database verification passed (${appCode} user assignments: ${userAppCount}).`,
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
