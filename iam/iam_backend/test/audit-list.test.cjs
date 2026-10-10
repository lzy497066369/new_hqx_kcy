const { test } = require('node:test');
const assert = require('node:assert/strict');

const { IamAuditService } = require('../dist/modules/audit/iam-audit.service');

test('filters and paginates IAM audit events', async () => {
  let query;
  const event = { action: 'oauth.refresh_token.rotated', id: '1', outcome: 'success', username: 'audit_user' };
  const service = new IamAuditService({
    async getDataSource() {
      return {
        getRepository() {
          return {
            findAndCount: async (options) => {
              query = options;
              return [[event], 31];
            },
          };
        },
      };
    },
  });

  const result = await service.list({
    action: 'oauth.refresh_token.rotated',
    endAt: '2026-07-15T23:59:59.999Z',
    limit: 10,
    outcome: 'success',
    page: 3,
    startAt: '2026-07-15T00:00:00.000Z',
    username: 'audit_user',
  });

  assert.deepEqual(result, { items: [event], limit: 10, page: 3, total: 31 });
  assert.equal(query.order.createdAt, 'DESC');
  assert.equal(query.skip, 20);
  assert.equal(query.take, 10);
  assert.equal(query.where.action, 'oauth.refresh_token.rotated');
  assert.equal(query.where.outcome, 'success');
  assert.equal(query.where.username._type, 'like');
  assert.equal(query.where.username._value, '%audit_user%');
  assert.equal(query.where.createdAt._type, 'between');
});
