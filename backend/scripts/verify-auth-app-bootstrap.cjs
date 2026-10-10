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

function readArguments(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    if (!values[index].startsWith('--')) continue;
    result[values[index].slice(2)] = values[index + 1];
    index += 1;
  }
  return result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const args = readArguments(process.argv.slice(2));
  const appCode = args['app-code'];
  const clientId = args['client-id'];
  const redirectUri = args['redirect-uri'];
  const username = args.username;
  assert(appCode && clientId && redirectUri && username, 'Missing bootstrap verification arguments');

  const env = { ...loadEnv(path.join(__dirname, '..', '.env')), ...process.env };
  const connection = await mysql.createConnection({
    database: env.DB_DATABASE,
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: Number(env.DB_PORT ?? 3306),
    user: env.DB_USERNAME,
  });
  try {
    const [[assignment]] = await connection.query(
      `SELECT ua.id
       FROM sys_user_app ua
       INNER JOIN sys_user u ON u.id = ua.user_id
       WHERE ua.app_code = ? AND ua.portal_type = 'admin' AND ua.status = 1 AND u.username = ?`,
      [appCode, username],
    );
    assert(assignment, 'User application assignment is missing');

    const [[role]] = await connection.query(
      `SELECT ur.id
       FROM sys_user_role ur
       INNER JOIN sys_user u ON u.id = ur.user_id
       INNER JOIN sys_role r ON r.id = ur.role_id
       WHERE u.username = ? AND r.app_code = ? AND r.portal_type = 'admin' AND r.code = 'admin' AND r.status = 1`,
      [username, appCode],
    );
    assert(role, 'Application admin role binding is missing');

    const [[client]] = await connection.query(
      'SELECT redirect_uris FROM sys_app_client WHERE app_code = ? AND client_id = ? AND status = 1',
      [appCode, clientId],
    );
    const redirects = client?.redirect_uris ? JSON.parse(client.redirect_uris) : [];
    assert(Array.isArray(redirects) && redirects.includes(redirectUri), 'Client redirect URI is missing');
    console.log(`Auth application bootstrap verification passed: ${appCode}.`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
