const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');

const { AuthService } = require('../dist/modules/auth/auth.service');
const { IamUserEntity } = require('../dist/modules/iam-admin/entities/iam-user.entity');

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

test('does not fall back to the bootstrap password when a database user exists', async () => {
  process.env.IAM_DB_DATABASE = 'iam_sso';
  process.env.IAM_ENABLE_BOOTSTRAP_LOGIN = 'true';
  process.env.IAM_BOOTSTRAP_USERNAME = 'conflict_admin';
  process.env.IAM_BOOTSTRAP_PASSWORD = 'BootstrapPassword1!';

  const database = {
    async getDataSource() {
      return {
        getRepository(entity) {
          if (entity === IamUserEntity) {
            return {
              findOne: async () => ({
                avatarPath: null,
                id: '1',
                passwordHash: 'DatabasePassword1!',
                realName: 'Database user',
                status: 1,
                username: 'conflict_admin',
              }),
            };
          }
          throw new Error('Unexpected repository lookup');
        },
      };
    },
  };
  const service = new AuthService(database, { record: async () => {} });

  await assert.rejects(
    () => service.login({ password: 'BootstrapPassword1!', username: 'conflict_admin' }),
    { status: 401 },
  );
});
