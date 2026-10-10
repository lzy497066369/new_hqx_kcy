const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const scriptPath = path.join(__dirname, '..', 'scripts', 'verify-business-sso-e2e.cjs');
const startScriptPath = path.join(__dirname, '..', '..', '..', 'backend', 'scripts', 'start-iam-client-e2e.ps1');

test('defines a repeatable client-portal IAM SSO E2E contract', () => {
  const script = fs.readFileSync(scriptPath, 'utf8');

  assert.match(script, /dotenv\.config\(/);
  assert.match(script, /IAM_DB_DATABASE \?\?= 'iam_sso'/);
  assert.match(script, /IAM_E2E_ISSUER \?\? 'http:\/\/127\.0\.0\.1:3101'/);
  assert.match(script, /IAM_E2E_BUSINESS_URL \?\? 'http:\/\/127\.0\.0\.1:3112'/);
  assert.match(script, /IAM_E2E_CLIENT_ID \?\? 'kjqb_client_web'/);
  assert.match(script, /IAM_E2E_REDIRECT_URI \?\? 'http:\/\/localhost:5998\/auth\/callback'/);
  assert.match(script, /DELETE FROM iam_refresh_token WHERE user_id = \?/);
  assert.match(script, /DELETE FROM iam_user WHERE id = \?/);
  assert.doesNotMatch(script, /DELETE FROM iam_oauth_client WHERE client_id = \?/);
});

test('rebuilds the isolated JWT business backend before local E2E startup', () => {
  const startScript = fs.readFileSync(startScriptPath, 'utf8');

  assert.match(startScript, /npm run build/);
  assert.match(startScript, /IAM_AUTH_MODE = 'jwt'/);
  assert.match(startScript, /IAM_APP_CODE = 'kjqb_client'/);
  assert.match(startScript, /IAM_CLIENT_ID = 'kjqb_client_web'/);
});
