const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const test = require('node:test');

const { OAuthService } = require('../dist/modules/oauth/oauth.service');

test('publishes retired RSA public keys together with the active JWKS key', () => {
  const previousKeyId = process.env.IAM_JWT_KEY_ID;
  const previousAdditionalKeys = process.env.IAM_JWT_ADDITIONAL_PUBLIC_JWKS_JSON;
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  try {
    process.env.IAM_JWT_KEY_ID = 'active-key';
    process.env.IAM_JWT_ADDITIONAL_PUBLIC_JWKS_JSON = JSON.stringify([
      { ...publicKey.export({ format: 'jwk' }), kid: 'retired-key' },
    ]);
    const service = new OAuthService({}, {});
    const jwks = service.getJwks();
    assert.deepEqual(jwks.keys.map((key) => key.kid), ['active-key', 'retired-key']);
    assert.deepEqual(jwks.keys.map((key) => key.use), ['sig', 'sig']);
    assert.deepEqual(jwks.keys.map((key) => key.alg), ['RS256', 'RS256']);
  } finally {
    if (previousKeyId === undefined) delete process.env.IAM_JWT_KEY_ID;
    else process.env.IAM_JWT_KEY_ID = previousKeyId;
    if (previousAdditionalKeys === undefined) delete process.env.IAM_JWT_ADDITIONAL_PUBLIC_JWKS_JSON;
    else process.env.IAM_JWT_ADDITIONAL_PUBLIC_JWKS_JSON = previousAdditionalKeys;
  }
});

test('rejects duplicate JWKS key IDs at startup', () => {
  const previousKeyId = process.env.IAM_JWT_KEY_ID;
  const previousAdditionalKeys = process.env.IAM_JWT_ADDITIONAL_PUBLIC_JWKS_JSON;
  try {
    process.env.IAM_JWT_KEY_ID = 'duplicate-key';
    process.env.IAM_JWT_ADDITIONAL_PUBLIC_JWKS_JSON = JSON.stringify([
      { e: 'AQAB', kid: 'duplicate-key', kty: 'RSA', n: 'test' },
    ]);
    assert.throws(() => new OAuthService({}, {}), /key IDs must be unique/);
  } finally {
    if (previousKeyId === undefined) delete process.env.IAM_JWT_KEY_ID;
    else process.env.IAM_JWT_KEY_ID = previousKeyId;
    if (previousAdditionalKeys === undefined) delete process.env.IAM_JWT_ADDITIONAL_PUBLIC_JWKS_JSON;
    else process.env.IAM_JWT_ADDITIONAL_PUBLIC_JWKS_JSON = previousAdditionalKeys;
  }
});

test('requires a stable RSA private key in production', () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousPrivateKey = process.env.IAM_JWT_PRIVATE_KEY_BASE64;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.IAM_JWT_PRIVATE_KEY_BASE64;
    assert.throws(() => new OAuthService({}, {}), /IAM_JWT_PRIVATE_KEY_BASE64 is required in production/);
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousPrivateKey === undefined) delete process.env.IAM_JWT_PRIVATE_KEY_BASE64;
    else process.env.IAM_JWT_PRIVATE_KEY_BASE64 = previousPrivateKey;
  }
});
