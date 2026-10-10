const { test } = require('node:test');
const assert = require('node:assert/strict');

const { IamAuditService } = require('../dist/modules/audit/iam-audit.service');

test('persists IAM audit events without passwords, tokens, or client secrets', async () => {
  const saved = [];
  const service = new IamAuditService({
    async getDataSource() {
      return {
        getRepository() {
          return {
            create: (value) => value,
            save: async (value) => saved.push(value),
          };
        },
      };
    },
  });

  await service.record({
    action: 'oauth.session.created',
    details: {
      clientSecret: 'must-not-persist',
      password: 'must-not-persist',
      refreshToken: 'must-not-persist',
      safeValue: 'kept',
    },
    outcome: 'success',
    username: 'audit_user',
  });

  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].details, { safeValue: 'kept' });
});
