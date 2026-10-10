const assert = require('node:assert/strict');
const { createHash, randomBytes } = require('node:crypto');
const path = require('node:path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

const rootDir = path.resolve(__dirname, '..');
const fallbackEnvPath = path.resolve(rootDir, '..', '..', 'backend', '.env');
dotenv.config({ path: process.env.IAM_ENV_FILE || fallbackEnvPath });

process.env.IAM_DB_DATABASE ??= 'iam_sso';

const iamBaseUrl = process.env.IAM_E2E_ISSUER ?? 'http://127.0.0.1:3101';
const businessBaseUrl = process.env.IAM_E2E_BUSINESS_URL ?? 'http://127.0.0.1:3112';
const appCode = 'kjqb_client';
const sourceSystem = process.env.IAM_COMPANY_SOURCE_SYSTEM ?? process.env.DB_DATABASE;
const redirectUri = process.env.IAM_E2E_REDIRECT_URI ?? 'http://localhost:5998/auth/callback';
const databaseConfigured = Boolean(process.env.IAM_DB_DATABASE && sourceSystem);
const challenge = (verifier) => createHash('sha256').update(verifier).digest('base64url');

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  assert.ok(response.ok, `${options.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  return { body, response };
}

async function openDatabase() {
  return mysql.createConnection({
    database: process.env.IAM_DB_DATABASE,
    host: process.env.IAM_DB_HOST ?? process.env.DB_HOST ?? '127.0.0.1',
    password: process.env.IAM_DB_PASSWORD ?? process.env.DB_PASSWORD,
    port: Number(process.env.IAM_DB_PORT ?? process.env.DB_PORT ?? 3306),
    user: process.env.IAM_DB_USERNAME ?? process.env.DB_USERNAME ?? 'root',
  });
}

async function cleanup(database, created) {
  if (!created) return;
  await database.execute('DELETE FROM iam_refresh_token WHERE user_id = ?', [created.userId]);
  await database.execute('DELETE FROM iam_oauth_authorization_code WHERE user_id = ?', [created.userId]);
  await database.execute('DELETE FROM iam_sso_session WHERE user_id = ?', [created.userId]);
  await database.execute('DELETE FROM iam_user_company_scope WHERE user_id = ?', [created.userId]);
  await database.execute('DELETE FROM iam_company_member WHERE user_id = ?', [created.userId]);
  await database.execute('DELETE FROM iam_user_role WHERE user_id = ?', [created.userId]);
  await database.execute('DELETE FROM iam_user_app WHERE user_id = ?', [created.userId]);
  await database.execute('DELETE FROM iam_user WHERE id = ?', [created.userId]);
}

async function main() {
  if (!databaseConfigured) throw new Error('IAM_DB_DATABASE and IAM_COMPANY_SOURCE_SYSTEM are required');
  const database = await openDatabase();
  const suffix = `e2e_${Date.now()}_${randomBytes(3).toString('hex')}`;
  const username = `${suffix}_user`;
  const password = 'E2ePassw0rd!';
  const clientId = process.env.IAM_E2E_CLIENT_ID ?? 'kjqb_client_web';
  let created;

  try {
    const bootstrap = await request(iamBaseUrl, '/auth/login', {
      body: JSON.stringify({
        password: process.env.IAM_BOOTSTRAP_PASSWORD ?? 'ChangeMe123!',
        username: process.env.IAM_BOOTSTRAP_USERNAME ?? 'iam_admin',
      }),
      method: 'POST',
    });
    const adminHeaders = { authorization: `Bearer ${bootstrap.body.accessToken}` };
    const [roles, companies] = await Promise.all([
      request(iamBaseUrl, `/iam/admin/apps/${appCode}/roles`, { headers: adminHeaders }),
      request(iamBaseUrl, '/iam/admin/companies', { headers: adminHeaders }),
    ]);
    const ownerRole = roles.body.items.find((role) => role.roleCode === 'enterprise_owner');
    const company = companies.body.items.find((item) => item.sourceCompanyId === '1' && item.sourceSystem === sourceSystem);
    assert.ok(ownerRole, 'enterprise_owner role is required');
    assert.ok(company, `company source ${sourceSystem}:1 is required`);

    const user = await request(iamBaseUrl, '/iam/admin/users', {
      body: JSON.stringify({ password, realName: 'E2E Client User', username }),
      headers: adminHeaders,
      method: 'POST',
    });
    created = { userId: user.body.id };
    await database.execute(
      'UPDATE iam_user SET source_system = ?, source_user_id = ? WHERE id = ?',
      [sourceSystem, '5', created.userId],
    );
    await request(iamBaseUrl, `/iam/admin/users/${created.userId}/apps/${appCode}`, {
      body: JSON.stringify({ homePath: '/dashboard/workspace', status: 1 }),
      headers: adminHeaders,
      method: 'PUT',
    });
    await request(iamBaseUrl, `/iam/admin/users/${created.userId}/apps/${appCode}/roles`, {
      body: JSON.stringify({ roleIds: [ownerRole.id] }),
      headers: adminHeaders,
      method: 'PUT',
    });
    await request(iamBaseUrl, `/iam/admin/companies/${company.id}/members`, {
      body: JSON.stringify({ appCode, dataScope: 'assigned', isDefault: true, isPrimary: true, memberType: 'owner', userId: created.userId }),
      headers: adminHeaders,
      method: 'PUT',
    });
    const session = await request(iamBaseUrl, '/oauth/session', {
      body: JSON.stringify({ password, username }),
      method: 'POST',
    });
    const verifier = randomBytes(48).toString('base64url');
    const authorize = await fetch(`${iamBaseUrl}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge(verifier)}&code_challenge_method=S256`, {
      headers: { cookie: session.response.headers.get('set-cookie') },
      redirect: 'manual',
    });
    assert.equal(authorize.status, 302);
    const code = new URL(authorize.headers.get('location')).searchParams.get('code');
    assert.ok(code, 'authorization code is required');
    const token = await request(iamBaseUrl, '/oauth/token', {
      body: JSON.stringify({ client_id: clientId, code, code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: redirectUri }),
      method: 'POST',
    });
    const authorization = `Bearer ${token.body.access_token}`;
    const [menus, companyScopes, businessCompanies, currentCompany] = await Promise.all([
      request(iamBaseUrl, `/iam/me/apps/${appCode}/menus`, { headers: { authorization } }),
      request(iamBaseUrl, `/iam/me/apps/${appCode}/companies`, { headers: { authorization } }),
      request(businessBaseUrl, '/client/companies', { headers: { authorization } }),
      request(businessBaseUrl, '/client/companies/current', { headers: { authorization } }),
    ]);
    assert.ok(menus.body.length > 0, 'IAM menus should be available');
    assert.deepEqual(companyScopes.body.map((item) => item.sourceCompanyId), ['1']);
    assert.deepEqual(businessCompanies.body.data.map((item) => item.id), ['1']);
    assert.equal(currentCompany.body.data.id, '1');

    const refreshed = await request(iamBaseUrl, '/oauth/token', {
      body: JSON.stringify({ client_id: clientId, grant_type: 'refresh_token', refresh_token: token.body.refresh_token }),
      method: 'POST',
    });
    assert.notEqual(refreshed.body.refresh_token, token.body.refresh_token);
    const logout = await fetch(`${iamBaseUrl}/oauth/logout`, {
      headers: { cookie: session.response.headers.get('set-cookie') },
      method: 'POST',
    });
    assert.equal(logout.status, 204);
    const revoked = await fetch(`${iamBaseUrl}/oauth/token`, {
      body: JSON.stringify({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshed.body.refresh_token }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    assert.equal(revoked.status, 400);
    console.log('Business SSO E2E verification passed.');
  } finally {
    try { await cleanup(database, created); } finally { await database.end(); }
  }
}

main().catch((error) => {
  console.error(`Business SSO E2E verification failed: ${error.message}`);
  process.exitCode = 1;
});
