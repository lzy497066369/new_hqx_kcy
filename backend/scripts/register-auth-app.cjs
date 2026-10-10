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
  const code = args.code?.trim().toLowerCase();
  const name = args.name?.trim();
  const portal = args.portal?.trim().toLowerCase() || 'admin';
  if (!code || !/^[a-z][a-z0-9_-]{1,63}$/.test(code)) {
    throw new Error('Use a valid --code (lowercase letters, numbers, hyphens, underscores)');
  }
  if (!name || name.length > 128) {
    throw new Error('Use a non-empty --name up to 128 characters');
  }
  if (!PORTALS.has(portal)) {
    throw new Error('Use --portal admin or --portal client');
  }

  const env = { ...loadEnv(path.join(__dirname, '..', '.env')), ...process.env };
  const connection = await mysql.createConnection({
    database: env.DB_DATABASE,
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: Number(env.DB_PORT ?? 3306),
    user: env.DB_USERNAME,
  });
  try {
    await connection.query(
      `INSERT INTO sys_app (code, name, default_portal, status)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), default_portal = VALUES(default_portal), status = 1`,
      [code, name, portal],
    );
    console.log(`Authentication application registered: ${code} (${name}).`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
