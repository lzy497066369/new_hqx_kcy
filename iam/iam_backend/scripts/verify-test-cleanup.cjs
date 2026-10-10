const mysql = require('mysql2/promise');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({
  path: process.env.IAM_ENV_FILE || path.resolve(__dirname, '..', '..', '..', 'backend', '.env'),
});

const databaseName = process.env.IAM_DB_DATABASE || 'iam_sso';

async function main() {
  const database = await mysql.createConnection({
    database: databaseName,
    host: process.env.IAM_DB_HOST || process.env.DB_HOST || '127.0.0.1',
    password: process.env.IAM_DB_PASSWORD || process.env.DB_PASSWORD,
    port: Number(process.env.IAM_DB_PORT || process.env.DB_PORT || 3306),
    user: process.env.IAM_DB_USERNAME || process.env.DB_USERNAME || 'root',
  });
  try {
    const [rows] = await database.query(
      "SELECT 'iam_app' AS entity, app_code AS value FROM iam_app WHERE app_code REGEXP '^(m1|oauth|ctx|platform_dept|all_scope)_[0-9]+' UNION ALL SELECT 'iam_user', username FROM iam_user WHERE username REGEXP '^(m1_user|oauth_user|ctx_user|platform_dept_user|platform_dept_member|all_scope_user)_[0-9]+' UNION ALL SELECT 'iam_company', company_name FROM iam_company WHERE company_name REGEXP '^(M1 company|Context company|All scope assigned|All scope unassigned) [0-9]+' UNION ALL SELECT 'iam_platform_department', dept_code FROM iam_platform_department WHERE dept_code REGEXP '^(root|project)_[0-9]+'",
    );
    if (rows.length) {
      throw new Error(`IAM integration test records remain: ${JSON.stringify(rows)}`);
    }
  } finally {
    await database.end();
  }
  console.log('IAM integration test cleanup verification passed.');
}

main().catch((error) => {
  console.error(`IAM integration test cleanup verification failed: ${error.message}`);
  process.exitCode = 1;
});
