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

function verifyRuntimeDefaults() {
  const {
    DEFAULT_AUTH_APP_CODE,
    resolveAuthRuntimeConfig,
  } = requireBuild('modules/auth/auth-runtime.config.js');

  assert(DEFAULT_AUTH_APP_CODE === 'kjqb', 'the current system app code must default to kjqb');
  assert(
    JSON.stringify(resolveAuthRuntimeConfig({})) ===
      JSON.stringify({ appCode: 'kjqb', sessionStore: 'memory', ssoEnabled: false, tokenMode: 'legacy', clientOnly: true }),
    'stage 0 defaults must preserve legacy authentication with SSO disabled',
  );
  assert(
    JSON.stringify(
      resolveAuthRuntimeConfig({
        AUTH_APP_CODE: 'crm',
        AUTH_SSO_ENABLED: 'true',
        AUTH_TOKEN_MODE: 'dual',
      }),
    ) === JSON.stringify({ appCode: 'crm', sessionStore: 'memory', ssoEnabled: true, tokenMode: 'dual', clientOnly: true }),
    'stage 0 authentication settings must accept explicit future migration values',
  );
  assert(resolveAuthRuntimeConfig({ AUTH_CLIENT_ONLY: 'false' }).clientOnly === false, 'explicit configuration may retain the admin portal');
  assert(resolveAuthRuntimeConfig({ AUTH_CLIENT_ONLY: 'invalid' }).clientOnly === true, 'invalid client-only configuration must not reopen the admin portal');
  assert(
    resolveAuthRuntimeConfig({ AUTH_TOKEN_MODE: 'invalid' }).tokenMode === 'legacy',
    'an invalid token mode must fail back to legacy behavior',
  );
}

function verifyLegacyEndpointsRemainAvailable() {
  const source = readSource('src/modules/auth/auth.controller.ts');
  for (const endpoint of ["@Post('login')", "@Post('refresh')", "@Post('logout')", "@Get('codes')"]) {
    assert(source.includes(endpoint), `legacy authentication endpoint is missing: ${endpoint}`);
  }
}

function main() {
  verifyRuntimeDefaults();
  verifyLegacyEndpointsRemainAvailable();
  console.log('Auth stage 0 verification passed.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
