const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const nginxConfigPath = path.join(__dirname, '..', 'nginx.conf');

test('proxies every public IAM protocol route through the production frontend', () => {
  const nginxConfig = fs.readFileSync(nginxConfigPath, 'utf8');

  for (const route of ['/health', '/.well-known/', '/oauth/', '/iam/', '/api/']) {
    assert.match(nginxConfig, new RegExp(`location[^\\n]*${route.replace(/[/.]/g, '\\$&')}`));
  }
  assert.match(nginxConfig, /proxy_pass http:\/\/iam-backend:3101/);
});
