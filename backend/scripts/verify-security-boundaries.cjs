#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const DIST_ROOT = path.join(BACKEND_ROOT, 'dist');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(BACKEND_ROOT, relativePath), 'utf8');
}

function requireBuild(relativePath) {
  const filePath = path.join(DIST_ROOT, relativePath);
  assert(
    fs.existsSync(filePath),
    `Missing build artifact: ${relativePath}. Run npm run build before this check.`,
  );
  return require(filePath);
}

async function assertRejected(callback, message, expectedStatus = 403) {
  try {
    await callback();
  } catch (error) {
    assert(
      error && error.status === expectedStatus,
      `${message}: expected HTTP ${expectedStatus}`,
    );
    return;
  }
  throw new Error(`${message}: access was unexpectedly allowed`);
}

function createContext(handler, currentUser, requestOverrides = {}) {
  class TestController {}

  return {
    getClass: () => TestController,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ currentUser, ...requestOverrides }),
    }),
  };
}

async function verifyPasswordUtility() {
  const { hashPassword, verifyPassword } = requireBuild(
    'common/utils/password.util.js',
  );
  const hash = await hashPassword('correct-password');

  assert(hash.startsWith('scrypt$'), 'password hash must use the scrypt format');
  assert(
    await verifyPassword('correct-password', hash),
    'correct password must pass verification',
  );
  assert(
    !(await verifyPassword('wrong-password', hash)),
    'wrong password must fail verification',
  );
  await require('node:assert/strict').rejects(
    () => verifyPassword('legacy-password', 'legacy-password'),
    /Password reset required/,
    'legacy plaintext passwords must fail closed instead of bypassing hashing',
  );
}

async function verifyPermissionGuard() {
  require('reflect-metadata');
  const { PermissionGuard } = requireBuild('common/guards/permission.guard.js');
  const {
    REQUIRED_PERMISSIONS_KEY,
  } = requireBuild('common/decorators/require-access.decorator.js');
  const handler = () => undefined;
  Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, ['System:User:List'], handler);

  const guard = new PermissionGuard();
  const standardUser = {
    id: 1,
    realName: 'Tester',
    roles: ['operator'],
    username: 'tester',
  };

  await assertRejected(
    () => guard.canActivate(createContext(handler, standardUser)),
    'user without permission',
  );
  assert(
    await guard.canActivate(
      createContext(handler, {
        ...standardUser,
        permissions: ['System:User:List'],
      }),
    ),
    'user with required permission must be allowed',
  );
  assert(
    await guard.canActivate(
      createContext(handler, { ...standardUser, roles: ['admin'] }),
    ),
    'administrator must retain permission bypass',
  );
}

async function verifyPortalGuard() {
  require('reflect-metadata');
  const { PortalGuard } = requireBuild('common/guards/portal.guard.js');
  const {
    REQUIRED_PORTALS_KEY,
  } = requireBuild('common/decorators/require-portal.decorator.js');
  const handler = () => undefined;
  Reflect.defineMetadata(REQUIRED_PORTALS_KEY, ['client'], handler);

  const guard = new PortalGuard();
  await assertRejected(
    () =>
      guard.canActivate(
        createContext(handler, {
          id: 1,
          portal: 'admin',
          realName: 'Administrator',
          roles: ['admin'],
          username: 'admin',
        }),
      ),
    'administrator token on a client route',
  );
  assert(
    guard.canActivate(
      createContext(handler, {
        id: 2,
        portal: 'client',
        realName: 'Client user',
        roles: ['enterprise_user'],
        username: 'client-user',
      }),
    ),
    'client token must be allowed on a client route',
  );
}

async function verifyQueryTokenScope() {
  const { AccessTokenGuard } = requireBuild('common/guards/access-token.guard.js');
  const guard = new AccessTokenGuard({
    findByAccessToken: (token) =>
      token === 'test-token'
        ? {
            user: {
              id: 1,
              realName: 'Client user',
              roles: ['enterprise_user'],
              username: 'client-user',
            },
          }
        : null,
  });
  const handler = () => undefined;

  await assertRejected(
    () =>
      guard.canActivate(
        createContext(handler, undefined, {
          method: 'GET',
          originalUrl: '/client/companies?access_token=test-token',
          headers: {},
          query: { access_token: 'test-token' },
        }),
      ),
    'query token on a regular API route',
  );
  assert(
    guard.canActivate(
      createContext(handler, undefined, {
        method: 'GET',
        originalUrl: '/client/enterprise-records/property/intellectualProperty/1/file?access_token=test-token',
        headers: {},
        query: { access_token: 'test-token' },
      }),
    ),
    'query token must remain available to protected browser file previews',
  );

  const crossAppGuard = new AccessTokenGuard({
    findByAccessToken: (token) =>
      token === 'soft-token'
        ? {
            user: {
              appCode: 'soft-copyright',
              id: 2,
              realName: 'Soft copyright user',
              roles: ['admin'],
              username: 'soft-admin',
            },
          }
        : null,
  });
  await assertRejected(
    () =>
      crossAppGuard.canActivate(
        createContext(handler, undefined, {
          headers: { authorization: 'Bearer soft-token' },
          method: 'GET',
          originalUrl: '/system/menu/list',
        }),
      ),
    'a different application session on a business route',
    401,
  );
}

async function verifySessionExpiry() {
  const {
    MemorySessionStore,
  } = requireBuild('infrastructure/cache/memory-session.store.js');
  const store = new MemorySessionStore();
  const user = {
    id: 1,
    realName: 'Session user',
    roles: ['operator'],
    username: 'session-user',
  };

  const activeSession = await store.createSession(user);
  assert(
    Date.parse(activeSession.expiresAt) < Date.parse(activeSession.refreshExpiresAt),
    'access token must expire before refresh token',
  );
  assert(
    await store.findByAccessToken(activeSession.accessToken),
    'new access token must be active',
  );

  const expiredAccess = await store.createSession(user);
  expiredAccess.expiresAt = new Date(Date.now() - 1000).toISOString();
  assert(
    (await store.findByAccessToken(expiredAccess.accessToken)) === null,
    'expired access token must be rejected and removed',
  );

  const expiredRefresh = await store.createSession(user);
  expiredRefresh.refreshExpiresAt = new Date(Date.now() - 1000).toISOString();
  assert(
    (await store.findByRefreshToken(expiredRefresh.refreshToken)) === null,
    'expired refresh token must be rejected and removed',
  );
}

async function verifyLoginThrottle() {
  const {
    LoginThrottleService,
  } = requireBuild('modules/auth/login-throttle.service.js');
  const throttle = new LoginThrottleService();
  const keys = ['account:admin:tester', 'ip:admin:127.0.0.1'];

  for (let index = 0; index < 4; index += 1) {
    throttle.recordFailure(keys);
    throttle.assertAllowed(keys);
  }
  throttle.recordFailure(keys);
  await assertRejected(
    () => throttle.assertAllowed(keys),
    'repeated failed login attempts',
    429,
  );

  const clearedThrottle = new LoginThrottleService();
  clearedThrottle.recordFailure(keys);
  clearedThrottle.clear(keys);
  clearedThrottle.assertAllowed(keys);
}

function verifyStaticBoundaries() {
  const isolationRequirements = [
    'src/modules/enterprise/profile/profile.service.ts',
    'src/modules/enterprise/user/user.service.ts',
  ];
  for (const file of isolationRequirements) {
    const source = readSource(file);
    for (const pattern of [
      'getScopedEnterpriseIds',
      "user.roles.includes('project_teacher')",
      'enterpriseTeacherRepo.find',
      'assertEnterpriseVisible',
    ]) {
      assert(source.includes(pattern), `${file} is missing enterprise scope check: ${pattern}`);
    }
  }

  const collectController = readSource(
    'src/modules/policy/collect/collect.controller.ts',
  );
  const routeLines = collectController.split(/\r?\n/);
  let routeCount = 0;
  for (let index = 0; index < routeLines.length; index += 1) {
    if (!/^\s*@(Get|Post|Put|Delete)\(/.test(routeLines[index])) {
      continue;
    }
    routeCount += 1;
    assert(
      /^\s*@RequirePermissions\('[^']+'\)/.test(routeLines[index + 1] ?? ''),
      `policy collection route at line ${index + 1} has no immediate permission requirement`,
    );
  }
  assert(routeCount > 0, 'no policy collection routes were found');
  assert(
    collectController.includes('@UseGuards(AccessTokenGuard, PermissionGuard)'),
    'policy collection controller must enable the authentication and permission guards',
  );

  const dashboardService = readSource('src/modules/dashboard/dashboard.service.ts');
  for (const pattern of [
    'this.assertAdminPortal(user);',
    "user.portal && user.portal !== 'admin'",
    "user.portal && user.portal !== 'client'",
  ]) {
    assert(
      dashboardService.includes(pattern),
      `dashboard portal isolation is missing: ${pattern}`,
    );
  }

  const clientController = readSource('src/modules/client/client.controller.ts');
  for (const pattern of [
    "@Get('enterprise-records/:moduleKey/:tabKey/:id/file')",
    "@Post('enterprise-media/uploads')",
    "@Get('enterprise-media/:type/:id/file')",
    'previewClientEnterpriseRecordFile',
    'previewClientEnterpriseMediaFile',
  ]) {
    assert(
      clientController.includes(pattern),
      `client enterprise file preview route is missing: ${pattern}`,
    );
  }

  const clientService = readSource('src/modules/client/client.service.ts');
  for (const pattern of [
    'getProfileRecordAttachmentPaths',
    'findProfileRecordOrFail(config, enterpriseId, id)',
    'permittedPaths.includes(requestedPath)',
    'uploadClientEnterpriseMedia',
    'previewClientEnterpriseMediaFile',
  ]) {
    assert(
      clientService.includes(pattern),
      `client enterprise file preview authorization is missing: ${pattern}`,
    );
  }

  const uploadController = readSource('src/modules/upload/upload.controller.ts');
  assert(
    uploadController.includes('this.isSharedStreamPath(storedPath)'),
    'generic upload stream must reject private files',
  );
  assert(
    uploadController.includes("storedPath.startsWith('policy/')"),
    'generic upload stream must allow only approved shared directories',
  );
  for (const pattern of [
    'MAX_STREAM_UPLOAD_BYTES',
    "request.headers['content-length']",
    'this.createSizeLimitedStream()',
    'await unlink(absolutePath).catch',
  ]) {
    assert(
      uploadController.includes(pattern),
      `stream upload size-limit safeguard is missing: ${pattern}`,
    );
  }

  const mainSource = readSource('src/main.ts');
  assert(
    !mainSource.includes("prefix: '/uploads/',"),
    'the whole upload root must not be mounted as a public static directory',
  );
  assert(
    mainSource.includes("prefix: '/uploads/policy/',"),
    'policy upload static directory is missing',
  );
  assert(
    mainSource.includes('function resolveCorsOrigins()'),
    'CORS origin whitelist resolver is missing',
  );
  assert(
    mainSource.includes("process.env.CORS_ORIGINS ?? ''"),
    'CORS origin whitelist must be environment-configurable',
  );
  assert(
    mainSource.includes('return false;'),
    'production must deny cross-origin requests when no origin is configured',
  );
}

async function main() {
  await verifyPasswordUtility();
  await verifyPermissionGuard();
  await verifyPortalGuard();
  await verifyQueryTokenScope();
  await verifySessionExpiry();
  await verifyLoginThrottle();
  verifyStaticBoundaries();
  console.log('Security boundary verification passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
