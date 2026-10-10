#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

function loadEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index < 1 || line.trim().startsWith('#')) continue;
    env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return env;
}

async function main() {
  const env = { ...loadEnv(path.join(__dirname, '..', '.env')), ...process.env };
  const connection = await mysql.createConnection({
    charset: 'utf8mb4',
    database: env.DB_DATABASE,
    host: env.DB_HOST,
    multipleStatements: true,
    password: env.DB_PASSWORD,
    port: Number(env.DB_PORT ?? 3306),
    user: env.DB_USERNAME,
  });

  try {
    await connection.query(
      fs.readFileSync(
        path.join(__dirname, '..', 'sql', 'enterprise-top-level-menu-p2.sql'),
        'utf8',
      ),
    );
    console.log('Enterprise top-level menu P2 SQL applied with utf8mb4.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
