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
  assert(
    fs.existsSync(filePath),
    `Missing build artifact: ${relativePath}. Run npm run build before this check.`,
  );
  return require(filePath);
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(BACKEND_ROOT, relativePath), 'utf8');
}

function verifyRedisConfiguration() {
  const { resolveRedisRuntimeConfig } = requireBuild(
    'infrastructure/cache/redis-runtime.config.js',
  );
  const disabled = resolveRedisRuntimeConfig({});
  assert(disabled.enabled === false, 'Redis must remain disabled by default');
  assert(disabled.url === undefined, 'disabled Redis must not create a connection URL');

  const configured = resolveRedisRuntimeConfig({
    REDIS_CONNECT_TIMEOUT_MS: '2500',
    REDIS_ENABLED: 'true',
    REDIS_KEY_PREFIX: 'auth:',
    REDIS_URL: 'redis://:secret@redis.example.test:6379/2',
  });
  assert(configured.enabled === true, 'REDIS_ENABLED=true must enable Redis');
  assert(configured.connectTimeoutMs === 2500, 'Redis timeout must be configurable');
  assert(configured.keyPrefix === 'auth:', 'Redis key prefix must be configurable');
  assert(configured.url === 'redis://:secret@redis.example.test:6379/2', 'Redis URL must be preserved');
}

function verifyDeploymentAndHealthWiring() {
  assert(
    fs.existsSync(path.join(BACKEND_ROOT, 'deploy', 'redis', 'docker-compose.yml')),
    'Redis deployment manifest is missing',
  );
  const appModule = readSource('src/app.module.ts');
  assert(appModule.includes('RedisModule'), 'Redis module must be registered by the application');
  const healthController = readSource('src/modules/health/health.controller.ts');
  assert(healthController.includes("@Get('health/redis')"), 'Redis health endpoint is missing');
}

function main() {
  verifyRedisConfiguration();
  verifyDeploymentAndHealthWiring();
  console.log('Redis stage 1 verification passed.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
