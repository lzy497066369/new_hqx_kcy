const { test } = require('node:test');
const assert = require('node:assert/strict');
const { of, lastValueFrom } = require('rxjs');

const {
  IamAdminAuditInterceptor,
} = require('../dist/modules/iam-admin/iam-admin-audit.interceptor');

test('records successful IAM administration writes without request bodies', async () => {
  const events = [];
  const interceptor = new IamAdminAuditInterceptor({
    record: async (event) => events.push(event),
  });
  const context = {
    switchToHttp() {
      return {
        getRequest() {
          return {
            iamUser: { userId: '7', username: 'admin' },
            method: 'PUT',
            originalUrl: '/iam/admin/users/9/apps/kjqb_client/roles',
          };
        },
      };
    },
  };

  await lastValueFrom(interceptor.intercept(context, { handle: () => of({ roleIds: ['4'] }) }));

  assert.deepEqual(events, [{
    action: 'iam.admin.write',
    actorUserId: '7',
    details: { method: 'PUT', path: '/iam/admin/users/9/apps/kjqb_client/roles' },
    eventType: 'administration',
    outcome: 'success',
    username: 'admin',
  }]);
});
