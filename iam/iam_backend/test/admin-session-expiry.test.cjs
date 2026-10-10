const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');

const { AuthService } = require('../dist/modules/auth/auth.service');

const previous = {
  IAM_BOOTSTRAP_PASSWORD: process.env.IAM_BOOTSTRAP_PASSWORD,
  IAM_BOOTSTRAP_USERNAME: process.env.IAM_BOOTSTRAP_USERNAME,
  IAM_DB_DATABASE: process.env.IAM_DB_DATABASE,
  IAM_ENABLE_BOOTSTRAP_LOGIN: process.env.IAM_ENABLE_BOOTSTRAP_LOGIN,
};

afterEach(() => {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('rejects an expired IAM administration session', async () => {
  delete process.env.IAM_DB_DATABASE;
  process.env.IAM_ENABLE_BOOTSTRAP_LOGIN = 'true';
  process.env.IAM_BOOTSTRAP_USERNAME = 'session_admin';
  process.env.IAM_BOOTSTRAP_PASSWORD = 'SessionPassword1!';
  const service = new AuthService({}, { record: async () => {} });
  const { accessToken } = await service.login({
    password: 'SessionPassword1!',
    username: 'session_admin',
  });

  service.sessions.get(accessToken).expiresAt = new Date(0);

  await assert.rejects(() => service.getCurrentUser(accessToken), { status: 401 });
});
