import assert from 'node:assert/strict';
import test from 'node:test';

import { IamSpaClient } from '../dist/index.js';

const accessToken = `header.${Buffer.from(JSON.stringify({ app_code: 'second_system', preferred_username: 'sdk_user' })).toString('base64url')}.signature`;

class MemoryStorage {
  values = new Map();

  getItem(key) { return this.values.get(key) ?? null; }
  removeItem(key) { this.values.delete(key); }
  setItem(key, value) { this.values.set(key, value); }
}

test('runs the authorization-code PKCE flow and serializes refresh requests', async () => {
  const storage = new MemoryStorage();
  const requests = [];
  let refreshCalls = 0;
  const client = new IamSpaClient({
    clientId: 'second_system_web',
    fetch: async (url, init = {}) => {
      requests.push({ body: init.body, method: init.method, url: String(url) });
      if (String(url).endsWith('/oauth/token')) {
        const body = JSON.parse(String(init.body));
        if (body.grant_type === 'refresh_token') {
          refreshCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 10));
          return Response.json({ access_token: accessToken, refresh_token: 'refresh-2' });
        }
        return Response.json({ access_token: accessToken, refresh_token: 'refresh-1' });
      }
      return new Response(null, { status: 204 });
    },
    issuer: 'https://iam.example.test/',
    redirectUri: 'https://second.example.test/auth/callback',
    storage,
  });

  const authorizationUrl = new URL(await client.createAuthorizationUrl('/workspace'));
  const state = authorizationUrl.searchParams.get('state');
  assert.equal(authorizationUrl.origin, 'https://iam.example.test');
  assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(state);

  const authorization = await client.finishAuthorization(`https://second.example.test/auth/callback?code=authorization-code&state=${state}`);
  assert.equal(authorization.accessToken, accessToken);
  assert.equal(authorization.claims.app_code, 'second_system');
  assert.equal(authorization.redirect, '/workspace');
  assert.equal(storage.getItem('iam-sso:second_system_web:refresh-token'), 'refresh-1');

  const [firstRefresh, secondRefresh] = await Promise.all([client.refresh(), client.refresh()]);
  assert.equal(firstRefresh, accessToken);
  assert.equal(secondRefresh, accessToken);
  assert.equal(refreshCalls, 1);

  await client.logout();
  assert.equal(storage.getItem('iam-sso:second_system_web:refresh-token'), null);
  assert.equal(requests.filter((request) => request.url.endsWith('/oauth/revoke')).length, 1);
});

test('keeps the default browser fetch bound to globalThis', async () => {
  const originalFetch = globalThis.fetch;
  const storage = new MemoryStorage();
  let invokedWithGlobalThis = false;

  globalThis.fetch = function fetchWithBrowserReceiver() {
    invokedWithGlobalThis = this === globalThis;
    return Promise.resolve(Response.json({ access_token: accessToken, refresh_token: 'refresh-default' }));
  };

  try {
    const client = new IamSpaClient({
      clientId: 'second_system_web',
      issuer: 'https://iam.example.test',
      redirectUri: 'https://second.example.test/auth/callback',
      storage,
    });
    const authorizationUrl = new URL(await client.createAuthorizationUrl());
    await client.finishAuthorization(`https://second.example.test/auth/callback?code=authorization-code&state=${authorizationUrl.searchParams.get('state')}`);
    assert.equal(invokedWithGlobalThis, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
