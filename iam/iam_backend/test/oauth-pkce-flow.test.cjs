const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');

const databaseConfigured = Boolean(process.env.IAM_DB_DATABASE);
const port = 31_003;
const baseUrl = `http://127.0.0.1:${port}`;
let created;
let server;

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function codeChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('iam_backend did not start in time');
}

async function json(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = response.status === 204 ? null : await response.json();
  assert.ok(response.ok, `${options.method ?? 'GET'} ${path} failed: ${JSON.stringify(body)}`);
  return { body, response };
}

test('issues JWTs through authorization-code PKCE and rotates refresh tokens', { skip: !databaseConfigured }, async (t) => {
  t.after(() => server?.kill());
  t.after(async () => {
    if (!created) return;
    const connection = await mysql.createConnection({
      database: process.env.IAM_DB_DATABASE,
      host: process.env.IAM_DB_HOST ?? '127.0.0.1',
      password: process.env.IAM_DB_PASSWORD,
      port: Number(process.env.IAM_DB_PORT ?? 3306),
      user: process.env.IAM_DB_USERNAME ?? 'root',
    });
    try {
      await connection.execute('DELETE FROM iam_audit_event WHERE app_code = ? OR client_id = ?', [created.appCode, created.clientId]);
      await connection.execute('DELETE FROM iam_refresh_token WHERE user_id = ?', [created.userId]);
      await connection.execute('DELETE FROM iam_oauth_authorization_code WHERE user_id = ?', [created.userId]);
      await connection.execute('DELETE FROM iam_sso_session WHERE user_id = ?', [created.userId]);
      await connection.execute('DELETE FROM iam_oauth_client WHERE app_code = (SELECT app_code FROM iam_app WHERE id = ?)', [created.appId]);
      await connection.execute('DELETE FROM iam_user_app WHERE user_id = ?', [created.userId]);
      await connection.execute('DELETE FROM iam_user WHERE id = ?', [created.userId]);
      await connection.execute('DELETE FROM iam_app WHERE id = ?', [created.appId]);
    } finally {
      await connection.end();
    }
  });
  server = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      IAM_SSO_LOGIN_URL: 'http://iam.example.test/oauth/login',
      IAM_BOOTSTRAP_PASSWORD: 'ChangeMe123!',
      IAM_BOOTSTRAP_USERNAME: 'iam_admin',
      PORT: String(port),
    },
    stdio: 'ignore',
  });
  await waitForHealth();

  const unauthenticatedAuthorize = await fetch(
    `${baseUrl}/oauth/authorize?response_type=code&client_id=missing&redirect_uri=https%3A%2F%2Fconsumer.example.test%2Fauth%2Fcallback&code_challenge=challenge&code_challenge_method=S256`,
    { redirect: 'manual' },
  );
  assert.equal(unauthenticatedAuthorize.status, 302);
  const loginUrl = new URL(unauthenticatedAuthorize.headers.get('location'));
  assert.equal(loginUrl.origin, 'http://iam.example.test');
  assert.match(loginUrl.searchParams.get('return_to') ?? '', /^\/oauth\/authorize\?/);

  const bootstrap = await json('/auth/login', {
    body: JSON.stringify({ password: 'ChangeMe123!', username: 'iam_admin' }),
    method: 'POST',
  });
  const adminHeaders = { authorization: `Bearer ${bootstrap.body.accessToken}` };
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const appCode = `oauth_${suffix}`;
  const username = `oauth_user_${suffix}`;
  const clientId = `oauth_client_${suffix}`;

  const app = await json('/iam/admin/apps', {
    body: JSON.stringify({ appCode, appName: 'OAuth test app' }),
    headers: adminHeaders,
    method: 'POST',
  });
  const user = await json('/iam/admin/users', {
    body: JSON.stringify({ password: 'StrongPassword1!', realName: 'OAuth user', username }),
    headers: adminHeaders,
    method: 'POST',
  });
  created = { appCode, appId: app.body.id, clientId, userId: user.body.id };

  await json(`/iam/admin/users/${user.body.id}/apps/${appCode}`, {
    body: JSON.stringify({ homePath: '/workspace', status: 1 }),
    headers: adminHeaders,
    method: 'PUT',
  });
  await json(`/iam/admin/apps/${appCode}/clients`, {
    body: JSON.stringify({
      clientId,
      clientType: 'public',
      grantTypes: ['authorization_code', 'refresh_token'],
      redirectUris: ['https://consumer.example.test/auth/callback'],
    }),
    headers: adminHeaders,
    method: 'POST',
  });

  const session = await json('/oauth/session', {
    body: JSON.stringify({ password: 'StrongPassword1!', username }),
    method: 'POST',
  });
  const sessionCookie = session.response.headers.get('set-cookie');
  assert.match(sessionCookie, /iam_sso_session=/);

  const verifier = base64Url(randomBytes(48));
  const authorize = await fetch(
    `${baseUrl}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent('https://consumer.example.test/auth/callback')}&scope=openid%20profile&state=state-123&code_challenge=${codeChallenge(verifier)}&code_challenge_method=S256`,
    { headers: { cookie: sessionCookie }, redirect: 'manual' },
  );
  assert.equal(authorize.status, 302);
  const callbackUrl = new URL(authorize.headers.get('location'));
  const code = callbackUrl.searchParams.get('code');
  assert.equal(callbackUrl.searchParams.get('state'), 'state-123');
  assert.ok(code);

  const token = await json('/oauth/token', {
    body: JSON.stringify({
      client_id: clientId,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: 'https://consumer.example.test/auth/callback',
    }),
    method: 'POST',
  });
  assert.equal(token.body.token_type, 'Bearer');
  assert.equal(token.body.access_token.split('.').length, 3);
  assert.ok(token.body.refresh_token.length > 30);

  const jwks = await json('/.well-known/jwks.json');
  assert.equal(jwks.body.keys[0].kty, 'RSA');
  assert.ok(jwks.body.keys[0].kid);

  const userinfo = await json('/oauth/userinfo', {
    headers: { authorization: `Bearer ${token.body.access_token}` },
  });
  assert.deepEqual(userinfo.body, {
    name: 'OAuth user',
    preferred_username: username,
    sub: user.body.id,
  });

  const refreshed = await json('/oauth/token', {
    body: JSON.stringify({ client_id: clientId, grant_type: 'refresh_token', refresh_token: token.body.refresh_token }),
    method: 'POST',
  });
  assert.notEqual(refreshed.body.refresh_token, token.body.refresh_token);

  const reusedImmediately = await fetch(`${baseUrl}/oauth/token`, {
    body: JSON.stringify({ client_id: clientId, grant_type: 'refresh_token', refresh_token: token.body.refresh_token }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(reusedImmediately.status, 400);
  const revokedSuccessor = await fetch(`${baseUrl}/oauth/token`, {
    body: JSON.stringify({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshed.body.refresh_token }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(revokedSuccessor.status, 400);

  await json(`/iam/admin/users/${user.body.id}`, {
    body: JSON.stringify({
      password: 'ChangedPassword1!',
      realName: 'OAuth user',
      status: 1,
      username,
    }),
    headers: adminHeaders,
    method: 'PUT',
  });
  const passwordChangedRefresh = await fetch(`${baseUrl}/oauth/token`, {
    body: JSON.stringify({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshed.body.refresh_token }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(passwordChangedRefresh.status, 400);

  const reused = await fetch(`${baseUrl}/oauth/token`, {
    body: JSON.stringify({ client_id: clientId, grant_type: 'refresh_token', refresh_token: token.body.refresh_token }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(reused.status, 400);

  const logout = await fetch(`${baseUrl}/oauth/logout`, {
    headers: { cookie: sessionCookie },
    method: 'POST',
  });
  assert.equal(logout.status, 204);

  const loggedOutRefresh = await fetch(`${baseUrl}/oauth/token`, {
    body: JSON.stringify({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshed.body.refresh_token }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(loggedOutRefresh.status, 400);

  await json('/oauth/revoke', {
    body: JSON.stringify({ client_id: clientId, token: randomBytes(48).toString('base64url') }),
    method: 'POST',
  });

  const activeSession = await json('/oauth/session', {
    body: JSON.stringify({ password: 'ChangedPassword1!', username }),
    method: 'POST',
  });
  const activeSessionCookie = activeSession.response.headers.get('set-cookie');
  const pendingVerifier = base64Url(randomBytes(48));
  const pendingAuthorization = await fetch(
    `${baseUrl}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent('https://consumer.example.test/auth/callback')}&code_challenge=${codeChallenge(pendingVerifier)}&code_challenge_method=S256`,
    { headers: { cookie: activeSessionCookie }, redirect: 'manual' },
  );
  assert.equal(pendingAuthorization.status, 302);
  const pendingCode = new URL(pendingAuthorization.headers.get('location')).searchParams.get('code');
  assert.ok(pendingCode);

  const refreshVerifier = base64Url(randomBytes(48));
  const refreshAuthorization = await fetch(
    `${baseUrl}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent('https://consumer.example.test/auth/callback')}&code_challenge=${codeChallenge(refreshVerifier)}&code_challenge_method=S256`,
    { headers: { cookie: activeSessionCookie }, redirect: 'manual' },
  );
  assert.equal(refreshAuthorization.status, 302);
  const refreshCode = new URL(refreshAuthorization.headers.get('location')).searchParams.get('code');
  assert.ok(refreshCode);
  const activeToken = await json('/oauth/token', {
    body: JSON.stringify({
      client_id: clientId,
      code: refreshCode,
      code_verifier: refreshVerifier,
      grant_type: 'authorization_code',
      redirect_uri: 'https://consumer.example.test/auth/callback',
    }),
    method: 'POST',
  });

  await json(`/iam/admin/apps/${app.body.id}`, {
    body: JSON.stringify({ appCode, appName: 'OAuth test app', status: 0 }),
    headers: adminHeaders,
    method: 'PUT',
  });

  const disabledAuthorize = await fetch(
    `${baseUrl}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent('https://consumer.example.test/auth/callback')}&code_challenge=${codeChallenge(base64Url(randomBytes(48)))}&code_challenge_method=S256`,
    { headers: { cookie: activeSessionCookie }, redirect: 'manual' },
  );
  assert.equal(disabledAuthorize.status, 400);

  const disabledCodeExchange = await fetch(`${baseUrl}/oauth/token`, {
    body: JSON.stringify({
      client_id: clientId,
      code: pendingCode,
      code_verifier: pendingVerifier,
      grant_type: 'authorization_code',
      redirect_uri: 'https://consumer.example.test/auth/callback',
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(disabledCodeExchange.status, 400);

  const disabledRefresh = await fetch(`${baseUrl}/oauth/token`, {
    body: JSON.stringify({ client_id: clientId, grant_type: 'refresh_token', refresh_token: activeToken.body.refresh_token }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(disabledRefresh.status, 400);

  const auditConnection = await mysql.createConnection({
    database: process.env.IAM_DB_DATABASE,
    host: process.env.IAM_DB_HOST ?? '127.0.0.1',
    password: process.env.IAM_DB_PASSWORD,
    port: Number(process.env.IAM_DB_PORT ?? 3306),
    user: process.env.IAM_DB_USERNAME ?? 'root',
  });
  try {
    const [auditEvents] = await auditConnection.execute(
      `SELECT action, app_code AS appCode, client_id AS clientId, details, outcome
       FROM iam_audit_event
       WHERE client_id = ?
         AND action IN ('oauth.authorization_code.exchanged', 'oauth.refresh_token.rotated')`,
      [clientId],
    );
    assert.ok(auditEvents.some((event) => event.action === 'oauth.authorization_code.exchanged' && event.outcome === 'success' && event.appCode === appCode));
    assert.ok(auditEvents.some((event) => event.action === 'oauth.authorization_code.exchanged' && event.outcome === 'failure'));
    assert.ok(auditEvents.some((event) => event.action === 'oauth.refresh_token.rotated' && event.outcome === 'success' && event.appCode === appCode));
    assert.ok(auditEvents.some((event) => event.action === 'oauth.refresh_token.rotated' && event.outcome === 'failure'));
    assert.ok(auditEvents.every((event) => event.details === null));
  } finally {
    await auditConnection.end();
  }
});
