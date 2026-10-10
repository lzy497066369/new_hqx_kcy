const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

const rootDir = path.resolve(__dirname, '..');
const fallbackEnvPath = path.resolve(rootDir, '..', '..', 'backend', '.env');
dotenv.config({ path: process.env.IAM_ENV_FILE || fallbackEnvPath });

const database = process.env.IAM_DB_DATABASE || 'iam_sso';
if (!/^[A-Za-z0-9_]+$/.test(database)) {
  throw new Error('IAM_DB_DATABASE must contain only letters, digits, and underscores');
}

const connectionOptions = {
  host: process.env.IAM_DB_HOST || process.env.DB_HOST || '127.0.0.1',
  multipleStatements: true,
  password: process.env.IAM_DB_PASSWORD || process.env.DB_PASSWORD,
  port: Number(process.env.IAM_DB_PORT || process.env.DB_PORT || 3306),
  user: process.env.IAM_DB_USERNAME || process.env.DB_USERNAME || 'root',
};

async function migrate() {
  const connection = await mysql.createConnection(connectionOptions);
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.changeUser({ database });
    const migrationFiles = fs
      .readdirSync(path.join(rootDir, 'sql'))
      .filter((file) => /^\d+-.*\.sql$/.test(file))
      .sort();
    for (const file of migrationFiles) {
      const schema = fs.readFileSync(path.join(rootDir, 'sql', file), 'utf8');
      await connection.query(schema);
    }
    console.log(`IAM schema is ready in database: ${database}`);
  } finally {
    await connection.end();
  }
}

migrate().catch((error) => {
  console.error(`IAM migration failed: ${error.message}`);
  process.exitCode = 1;
});
