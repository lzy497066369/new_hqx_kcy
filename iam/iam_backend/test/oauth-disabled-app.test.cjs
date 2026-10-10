const { test } = require('node:test');
const assert = require('node:assert/strict');

const { OAuthService } = require('../dist/modules/oauth/oauth.service');
const { IamAppEntity } = require('../dist/modules/iam-admin/entities/iam-app.entity');
const { IamOAuthClientEntity } = require('../dist/modules/iam-admin/entities/iam-oauth-client.entity');

test('rejects an OAuth client when its IAM application is disabled', async () => {
  const service = new OAuthService({
    async getDataSource() {
      return {
        getRepository(entity) {
          if (entity === IamOAuthClientEntity) {
            return { findOne: async () => ({ appCode: 'disabled_app', clientId: 'disabled_client', status: 1 }) };
          }
          if (entity === IamAppEntity) {
            return { findOne: async (options) => options.where.status === 1 ? null : ({ appCode: 'disabled_app', status: 0 }) };
          }
          throw new Error('Unexpected repository lookup');
        },
      };
    },
  }, { record: async () => {} });

  await assert.rejects(
    () => service.requireEnabledClient('disabled_client'),
    { status: 400 },
  );
});
