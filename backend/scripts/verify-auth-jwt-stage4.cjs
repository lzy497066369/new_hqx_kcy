#!/usr/bin/env node

const { generateKeyPairSync } = require('node:crypto');
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

function expectRejected(callback, message) {
  try {
    callback();
  } catch (error) {
    assert(error && error.status === 401, message);
    return;
  }
  throw new Error(message);
}

function main() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    publicKeyEncoding: { format: 'pem', type: 'spki' },
  });
  process.env.AUTH_APP_CODE = 'kjqb';
  process.env.AUTH_TOKEN_MODE = 'jwt';
  process.env.AUTH_JWT_PRIVATE_KEY = privateKey;
  process.env.AUTH_JWT_PUBLIC_KEY = publicKey;
  process.env.AUTH_JWT_KEY_ID = 'test-key';
  process.env.AUTH_JWT_ISSUER = 'test-issuer';

  const { AuthJwtService } = requireBuild('modules/auth/auth-jwt.service.js');
  const service = new AuthJwtService();
  const token = service.issueAccessToken(
    {
      appCode: 'crm',
      id: 7,
      portal: 'admin',
      realName: 'JWT user',
      roles: ['operator'],
      username: 'jwt-user',
    },
    'session-7',
  );
  const claims = service.verifyAccessToken(token, null);
  assert(claims.sub === '7', 'JWT subject must contain the user id');
  assert(claims.jti === 'session-7', 'JWT id must contain the session id');
  assert(claims.app_code === 'crm', 'JWT must contain the application code');
  assert(service.getJwks().keys[0].kid === 'test-key', 'JWKS must expose the configured key id');

  const [header, payload, signature] = token.split('.');
  const changedSignature = signature[0] === 'a' ? 'b' : 'a';
  const tampered = `${header}.${payload}.${changedSignature}${signature.slice(1)}`;
  expectRejected(
    () => service.verifyAccessToken(token),
    'a cross-application JWT must be rejected by an application route',
  );
  expectRejected(
    () => service.verifyAccessToken(tampered, null),
    'tampered JWT must be rejected',
  );
  console.log('Auth JWT stage 4 verification passed.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
