const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  IamAdminAccessGuard,
} = require('../dist/modules/iam-admin/iam-admin-access.guard');
const { IamRoleEntity } = require('../dist/modules/iam-admin/entities/iam-role.entity');
const { IamUserEntity } = require('../dist/modules/iam-admin/entities/iam-user.entity');
const { IamUserRoleEntity } = require('../dist/modules/iam-admin/entities/iam-user-role.entity');

function contextFor(roles, userId = 'user-1') {
  return {
    switchToHttp() {
      return {
        getRequest() {
          return { iamUser: { roles, userId } };
        },
      };
    },
  };
}

function databaseFor({ active = true, roles = ['super_admin'] } = {}) {
  return {
    async getDataSource() {
      return {
        getRepository(entity) {
          if (entity === IamUserEntity) return { findOne: async () => (active ? { id: 'user-1', status: 1 } : null) };
          if (entity === IamUserRoleEntity) return { find: async () => roles.map((_, index) => ({ roleId: String(index + 1) })) };
          if (entity === IamRoleEntity) return { findByIds: async () => roles.map((roleCode) => ({ appCode: 'iam_admin', roleCode, status: 1 })) };
          throw new Error('Unexpected repository lookup');
        },
      };
    },
  };
}

test('rejects IAM administration requests without the super_admin role', async () => {
  const guard = new IamAdminAccessGuard(databaseFor({ roles: ['viewer'] }));

  await assert.rejects(
    () => guard.canActivate(contextFor(['enterprise_owner'])),
    { status: 403 },
  );
});

test('allows IAM administration requests for an active iam_admin super_admin', async () => {
  const guard = new IamAdminAccessGuard(databaseFor());

  assert.equal(await guard.canActivate(contextFor(['super_admin'])), true);
});

test('rejects an IAM administrator after the account is disabled', async () => {
  const guard = new IamAdminAccessGuard(databaseFor({ active: false }));

  await assert.rejects(
    () => guard.canActivate(contextFor(['super_admin'])),
    { status: 403 },
  );
});
