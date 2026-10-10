const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadEnv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const env = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

async function main() {
  const envPath = process.env.ENV_PATH
    ? path.resolve(process.env.ENV_PATH)
    : path.resolve(__dirname, '..', '.env');
  const env = loadEnv(envPath);

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT ?? 3306),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    timezone: '+08:00',
  });

  try {
    const [rows] = await connection.query(
      `SELECT COLUMN_NAME, COLUMN_DEFAULT, EXTRA
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'sys_operation_log'
         AND COLUMN_NAME IN ('created_at', 'updated_at')
       ORDER BY COLUMN_NAME`,
    );

    console.log('[before]', rows);

    await connection.query(
      'ALTER TABLE `sys_operation_log` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    );
    await connection.query(
      'ALTER TABLE `sys_operation_log` MODIFY COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    );

    const [afterRows] = await connection.query(
      `SELECT COLUMN_NAME, COLUMN_DEFAULT, EXTRA
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'sys_operation_log'
         AND COLUMN_NAME IN ('created_at', 'updated_at')
       ORDER BY COLUMN_NAME`,
    );

    console.log('[after]', afterRows);
    console.log('sys_operation_log timestamps fixed.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
