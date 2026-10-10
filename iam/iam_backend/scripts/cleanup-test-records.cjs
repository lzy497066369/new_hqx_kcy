const mysql = require('mysql2/promise');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({
  path: process.env.IAM_ENV_FILE || path.resolve(__dirname, '..', '..', '..', 'backend', '.env'),
});

const testAppPattern = '^(m1|oauth|ctx|platform_dept|all_scope)_[0-9]+';
const testUserPattern = '^(m1_user|oauth_user|ctx_user|platform_dept_user|platform_dept_member|all_scope_user)_[0-9]+';
const testCompanyPattern = '^(M1 company|Context company|All scope assigned|All scope unassigned) [0-9]+';
const testDepartmentPattern = '^(root|project)_[0-9]+';

async function main() {
  const database = await mysql.createConnection({
    database: process.env.IAM_DB_DATABASE || 'iam_sso',
    host: process.env.IAM_DB_HOST || process.env.DB_HOST || '127.0.0.1',
    password: process.env.IAM_DB_PASSWORD || process.env.DB_PASSWORD,
    port: Number(process.env.IAM_DB_PORT || process.env.DB_PORT || 3306),
    user: process.env.IAM_DB_USERNAME || process.env.DB_USERNAME || 'root',
  });

  try {
    await database.beginTransaction();
    const [[{ count: appCount }]] = await database.query('SELECT COUNT(*) AS count FROM iam_app WHERE app_code REGEXP ?', [testAppPattern]);
    const [[{ count: userCount }]] = await database.query('SELECT COUNT(*) AS count FROM iam_user WHERE username REGEXP ?', [testUserPattern]);
    const [[{ count: companyCount }]] = await database.query('SELECT COUNT(*) AS count FROM iam_company WHERE company_name REGEXP ?', [testCompanyPattern]);
    const [[{ count: departmentCount }]] = await database.query('SELECT COUNT(*) AS count FROM iam_platform_department WHERE dept_code REGEXP ?', [testDepartmentPattern]);

    await database.query('DELETE FROM iam_admin_session WHERE user_id IN (SELECT id FROM iam_user WHERE username REGEXP ?)', [testUserPattern]);
    await database.query('DELETE FROM iam_refresh_token WHERE user_id IN (SELECT id FROM iam_user WHERE username REGEXP ?)', [testUserPattern]);
    await database.query('DELETE FROM iam_oauth_authorization_code WHERE user_id IN (SELECT id FROM iam_user WHERE username REGEXP ?)', [testUserPattern]);
    await database.query('DELETE FROM iam_sso_session WHERE user_id IN (SELECT id FROM iam_user WHERE username REGEXP ?)', [testUserPattern]);
    await database.query('DELETE FROM iam_user_app_context WHERE user_id IN (SELECT id FROM iam_user WHERE username REGEXP ?)', [testUserPattern]);
    await database.query('DELETE FROM iam_user_company_scope WHERE user_id IN (SELECT id FROM iam_user WHERE username REGEXP ?) OR company_id IN (SELECT id FROM iam_company WHERE company_name REGEXP ?)', [testUserPattern, testCompanyPattern]);
    await database.query('DELETE FROM iam_company_member WHERE user_id IN (SELECT id FROM iam_user WHERE username REGEXP ?) OR company_id IN (SELECT id FROM iam_company WHERE company_name REGEXP ?)', [testUserPattern, testCompanyPattern]);
    await database.query('DELETE FROM iam_user_platform_department WHERE user_id IN (SELECT id FROM iam_user WHERE username REGEXP ?) OR department_id IN (SELECT id FROM iam_platform_department WHERE dept_code REGEXP ?)', [testUserPattern, testDepartmentPattern]);
    await database.query('DELETE FROM iam_user_role WHERE user_id IN (SELECT id FROM iam_user WHERE username REGEXP ?) OR app_code REGEXP ?', [testUserPattern, testAppPattern]);
    await database.query('DELETE FROM iam_user_app WHERE user_id IN (SELECT id FROM iam_user WHERE username REGEXP ?) OR app_code REGEXP ?', [testUserPattern, testAppPattern]);
    await database.query('DELETE FROM iam_oauth_client WHERE app_code REGEXP ?', [testAppPattern]);
    await database.query('DELETE FROM iam_role_permission WHERE role_id IN (SELECT id FROM iam_role WHERE app_code REGEXP ?)', [testAppPattern]);
    await database.query('DELETE FROM iam_role WHERE app_code REGEXP ?', [testAppPattern]);
    await database.query('DELETE FROM iam_permission WHERE app_code REGEXP ?', [testAppPattern]);
    await database.query('DELETE FROM iam_menu WHERE app_code REGEXP ?', [testAppPattern]);
    await database.query('DELETE FROM iam_platform_department WHERE dept_code REGEXP ?', [testDepartmentPattern]);
    await database.query('DELETE FROM iam_company WHERE company_name REGEXP ?', [testCompanyPattern]);
    await database.query('DELETE FROM iam_user WHERE username REGEXP ?', [testUserPattern]);
    await database.query('DELETE FROM iam_app WHERE app_code REGEXP ?', [testAppPattern]);
    await database.commit();

    console.log(`Removed IAM test records: apps=${appCount}, users=${userCount}, companies=${companyCount}, platformDepartments=${departmentCount}.`);
  } catch (error) {
    await database.rollback();
    throw error;
  } finally {
    await database.end();
  }
}

main().catch((error) => {
  console.error(`IAM test record cleanup failed: ${error.message}`);
  process.exitCode = 1;
});
