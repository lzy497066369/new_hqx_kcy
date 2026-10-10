#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const DIST_ROOT = path.join(BACKEND_ROOT, 'dist');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requireBuild(relativePath) {
  const filePath = path.join(DIST_ROOT, relativePath);
  assert(fs.existsSync(filePath), `Missing build artifact: ${relativePath}`);
  return require(filePath);
}

class FakeRedis {
  constructor() {
    this.values = new Map();
  }

  multi() {
    const commands = [];
    return {
      set: (...args) => {
        commands.push(args);
        return this;
      },
      exec: async () => {
        for (const [key, value] of commands.map((command) => command.slice(0, 2))) {
          this.values.set(key, value);
        }
        return commands.map(() => [null, 'OK']);
      },
    };
  }

  async get(key) {
    return this.values.get(key) ?? null;
  }

  async getdel(key) {
    const value = await this.get(key);
    this.values.delete(key);
    return value;
  }

  async del(...keys) {
    keys.forEach((key) => this.values.delete(key));
    return keys.length;
  }
}

async function main() {
  const { resolveAuthRuntimeConfig } = requireBuild(
    'modules/auth/auth-runtime.config.js',
  );
  assert(
    resolveAuthRuntimeConfig({ AUTH_SESSION_STORE: 'redis' }).sessionStore ===
      'redis',
    'AUTH_SESSION_STORE=redis must select the Redis session store',
  );
  assert(
    resolveAuthRuntimeConfig({ AUTH_SESSION_STORE: 'invalid' }).sessionStore ===
      'memory',
    'invalid session store settings must fall back to memory',
  );
  const { RedisSessionStore } = requireBuild(
    'infrastructure/cache/redis-session.store.js',
  );
  const fakeRedis = new FakeRedis();
  const store = new RedisSessionStore({
    getClient: async () => fakeRedis,
  }, {
    shouldIssue: () => false,
  });
  const user = {
    id: 1,
    realName: 'Session user',
    roles: ['operator'],
    username: 'session-user',
  };

  const session = await store.createSession(user);
  assert(
    await store.findByAccessToken(session.accessToken),
    'Redis access session must be readable',
  );
  const rotated = await store.rotateSession(session.refreshToken);
  assert(rotated, 'Redis refresh token must rotate to a new session');
  assert(
    (await store.findByRefreshToken(session.refreshToken)) === null,
    'Redis refresh token must be single-use',
  );
  assert(
    (await store.findByAccessToken(session.accessToken)) === null,
    'old Redis access token must be revoked after rotation',
  );
  await store.revokeByAccessToken(rotated.accessToken);
  assert(
    (await store.findByRefreshToken(rotated.refreshToken)) === null,
    'revoking an access token must remove its refresh session',
  );
  console.log('Auth session stage 3 verification passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
