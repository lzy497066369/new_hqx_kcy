const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('renders audit timestamps and query boundaries in Asia/Shanghai', () => {
  const source = fs.readFileSync(path.resolve(__dirname, 'index.vue'), 'utf8');
  assert.match(source, /const BEIJING_TIMEZONE = 'Asia\/Shanghai'/);
  assert.match(source, /dayjs\(value\)\.tz\(BEIJING_TIMEZONE\)\.format\('YYYY-MM-DD HH:mm:ss'\)/);
  assert.match(source, /dayjs\.tz\(value, 'YYYY-MM-DDTHH:mm:ss', BEIJING_TIMEZONE\)\.format\('YYYY-MM-DDTHH:mm:ssZ'\)/);
});
