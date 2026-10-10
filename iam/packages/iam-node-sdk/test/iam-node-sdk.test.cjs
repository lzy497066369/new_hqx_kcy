const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const test = require('node:test');

const {
  IamCompanyContextClient,
  IamJwtVerifier,
  IamTokenValidationError,
} = require('../dist');

function signToken(privateKey, payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${header}.${body}`;
  return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
}

test('verifies IAM JWT claims and manages IAM company context', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const calls = [];
  const companyScopes = [{ appCode: 'second_system', companyName: 'Second company', dataScope: 'assigned', id: 'iam-company-2', isDefault: true, relationType: 'owner', sourceCompanyId: '2', sourceSystem: 'second_system' }];
  const fetcher = async (url, init = {}) => {
    calls.push({ headers: init.headers, method: init.method ?? 'GET', url: String(url) });
    if (String(url).endsWith('/jwks.json')) {
      return Response.json({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'test-key' }] });
    }
    return Response.json(companyScopes);
  };
  const verifier = new IamJwtVerifier({
    appCode: 'second_system',
    audience: 'second_system_web',
    fetch: fetcher,
    issuer: 'https://iam.example.test',
    jwksUrl: 'https://iam.example.test/.well-known/jwks.json',
  });
  const token = signToken(privateKey, {
    app_code: 'second_system',
    aud: 'second_system_web',
    exp: Math.floor(Date.now() / 1000) + 300,
    iss: 'https://iam.example.test',
    permissions: ['Company:Read'],
    preferred_username: 'sdk_user',
    roles: ['reader'],
    source_user_id: '42',
    sub: '1002',
  });
  const user = await verifier.verify(token);
  assert.deepEqual(user, {
    appCode: 'second_system',
    id: '42',
    permissions: ['Company:Read'],
    realName: 'sdk_user',
    roles: ['reader'],
    sourceUserId: '42',
    username: 'sdk_user',
  });

  await assert.rejects(
    () => verifier.verify(signToken(privateKey, {
      app_code: 'second_system', aud: 'wrong_client', exp: Math.floor(Date.now() / 1000) + 300, iss: 'https://iam.example.test', sub: '1002',
    })),
    IamTokenValidationError,
  );

  const malformedJwksVerifier = new IamJwtVerifier({
    appCode: 'second_system',
    audience: 'second_system_web',
    fetch: async () => Response.json({ keys: [{ e: 'AQAB', kid: 'test-key', kty: 'RSA', n: 'not-a-key' }] }),
    issuer: 'https://iam.example.test',
    jwksUrl: 'https://iam.example.test/.well-known/jwks.json',
  });
  await assert.rejects(() => malformedJwksVerifier.verify(token), IamTokenValidationError);

  const companies = new IamCompanyContextClient({ appCode: 'second_system', baseUrl: 'https://iam.example.test', fetch: fetcher });
  assert.deepEqual(await companies.listCompanies(token), companyScopes);
  assert.deepEqual(await companies.setDefaultCompany(token, 'iam-company-2'), companyScopes);
  assert.equal(calls.at(-1).url, 'https://iam.example.test/iam/me/apps/second_system/companies/iam-company-2/default');
});
