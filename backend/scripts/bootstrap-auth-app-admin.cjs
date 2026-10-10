#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const PORTALS = new Set(['admin', 'client']);

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
    const key = values[index];
    if (!key.startsWith('--')) continue;
    result[key.slice(2)] = values[index + 1];
    index += 1;
  }
  return result;
}

async function main() {
  const args = readArguments(process.argv.slice(2));
  const appCode = args['app-code']?.trim().toLowerCase();
  const clientId = args['client-id']?.trim();
  const redirectUri = args['redirect-uri']?.trim();
  const portal = args.portal?.trim().toLowerCase() || 'admin';
  const username = args.username?.trim();

  if (!appCode || !/^[a-z][a-z0-9_-]{1,63}$/.test(appCode)) {
    throw new Error('Use a valid --app-code');
  }
  if (!username) throw new Error('Use --username');
  if (!clientId || !/^[a-z][a-z0-9_-]{2,127}$/.test(clientId)) {
    throw new Error('Use a valid --client-id');
  }
  if (!redirectUri || !/^https:\/\//.test(redirectUri)) {
    throw new Error('Use an HTTPS --redirect-uri');
  }
  if (!PORTALS.has(portal)) throw new Error('Use --portal admin or --portal client');

  const env = { ...loadEnv(path.join(__dirname, '..', '.env')), ...process.env };
  const connection = await mysql.createConnection({
    database: env.DB_DATABASE,
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: Number(env.DB_PORT ?? 3306),
    user: env.DB_USERNAME,
  });
  try {
    await connection.beginTransaction();
    const [[app]] = await connection.query(
      'SELECT id FROM sys_app WHERE code = ? AND status = 1 FOR UPDATE',
      [appCode],
    );
    if (!app) throw new Error(`Active application not found: ${appCode}`);

    const [[user]] = await connection.query(
      'SELECT id FROM sys_user WHERE username = ? AND status = 1 FOR UPDATE',
      [username],
    );
    if (!user) throw new Error(`Active user not found: ${username}`);

    await connection.query(
      `INSERT INTO sys_role (app_code, portal_type, code, name, status)
       VALUES (?, ?, 'admin', '系统管理员', 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), status = 1`,
      [appCode, portal],
    );
    const [[role]] = await connection.query(
      'SELECT id FROM sys_role WHERE app_code = ? AND portal_type = ? AND code = ? FOR UPDATE',
      [appCode, portal, 'admin'],
    );

    await connection.query(
      `INSERT INTO sys_user_app (user_id, app_code, portal_type, is_default, status)
       VALUES (?, ?, ?, 1, 1)
       ON DUPLICATE KEY UPDATE is_default = 1, status = 1`,
      [user.id, appCode, portal],
    );
    await connection.query(
      'INSERT IGNORE INTO sys_user_role (user_id, role_id) VALUES (?, ?)',
      [user.id, role.id],
    );
    await connection.query(
      `INSERT INTO sys_app_client (app_code, client_id, client_type, redirect_uris, status)
       VALUES (?, ?, 'public', ?, 1)
       ON DUPLICATE KEY UPDATE app_code = VALUES(app_code), client_type = VALUES(client_type), redirect_uris = VALUES(redirect_uris), status = 1`,
      [appCode, clientId, JSON.stringify([redirectUri])],
    );
    await connection.commit();
    console.log(
      `Bootstrapped ${appCode}: user ${username}, role admin, client ${clientId}.`,
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
