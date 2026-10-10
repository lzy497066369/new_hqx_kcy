const assert = require('node:assert/strict');
const test = require('node:test');

const { verifyPassword } = require('../dist/common/password.util.js');

test('accepts a legacy plaintext password during the one-time migration window', async () => {
  assert.equal(await verifyPassword('123456', '123456'), true);
  assert.equal(await verifyPassword('incorrect', '123456'), false);
});
