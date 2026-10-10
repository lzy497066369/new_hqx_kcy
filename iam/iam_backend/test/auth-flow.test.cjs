const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const port = 31_001;
const baseUrl = `http://127.0.0.1:${port}`;
let server;

async function waitForHealth() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return response;
      }
    } catch {
      // The Nest process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('iam_backend did not start in time');
}

test('provides the bootstrap login flow required by the IAM admin frontend', async () => {
  server = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      IAM_BOOTSTRAP_PASSWORD: 'ChangeMe123!',
      IAM_BOOTSTRAP_USERNAME: 'iam_admin',
      PORT: String(port),
    },
    stdio: 'ignore',
  });

  const healthResponse = await waitForHealth();
  assert.deepEqual(await healthResponse.json(), {
    service: 'iam_backend',
    status: 'ok',
  });

  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    body: JSON.stringify({
      password: 'ChangeMe123!',
      remember: false,
      username: 'iam_admin',
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(loginResponse.status, 201);
  const { accessToken } = await loginResponse.json();
  assert.equal(typeof accessToken, 'string');
  assert.ok(accessToken.length > 20);

  const throttledUsername = `throttle_${Date.now()}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rejected = await fetch(`${baseUrl}/auth/login`, {
      body: JSON.stringify({ password: 'WrongPassword1!', username: throttledUsername }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    assert.equal(rejected.status, 401);
  }
  const throttled = await fetch(`${baseUrl}/auth/login`, {
    body: JSON.stringify({ password: 'WrongPassword1!', username: throttledUsername }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(throttled.status, 429);

  const userResponse = await fetch(`${baseUrl}/user/info`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  assert.equal(userResponse.status, 200);
  const user = await userResponse.json();
  assert.equal(typeof user.expiresAt, 'string');
  assert.ok(Date.parse(user.expiresAt) > Date.now());
  assert.deepEqual({ ...user, expiresAt: '<date>' }, {
    avatar: '',
    expiresAt: '<date>',
    homePath: '/iam/overview',
    portal: 'admin',
    realName: 'IAM 管理员',
    roles: ['super_admin'],
    userId: 'bootstrap-admin',
    username: 'iam_admin',
  });
});

after(() => {
  server?.kill();
});
