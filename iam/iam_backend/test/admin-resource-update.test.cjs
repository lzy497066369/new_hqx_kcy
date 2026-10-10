const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');

const databaseConfigured = Boolean(process.env.IAM_DB_DATABASE);
const port = 31_020;
const baseUrl = `http://127.0.0.1:${port}`;
let created;
let server;

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(`${baseUrl}/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('iam_backend did not start in time');
}

async function request(path, accessToken, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = response.status === 204 ? null : await response.json();
  assert.ok(response.ok, `${options.method ?? 'GET'} ${path} failed: ${JSON.stringify(body)}`);
  return body;
}

test('updates and disables IAM security resources without deleting them', { skip: !databaseConfigured }, async (t) => {
  t.after(() => server?.kill());
  t.after(async () => {
    if (!created) return;
    const db = await mysql.createConnection({ database: process.env.IAM_DB_DATABASE, host: process.env.IAM_DB_HOST ?? '127.0.0.1', password: process.env.IAM_DB_PASSWORD, port: Number(process.env.IAM_DB_PORT ?? 3306), user: process.env.IAM_DB_USERNAME ?? 'root' });
    try {
      await db.execute('DELETE FROM iam_role_permission WHERE role_id IN (SELECT id FROM iam_role WHERE app_code = ?)', [created.appCode]);
      await db.execute('DELETE FROM iam_menu WHERE app_code = ?', [created.appCode]);
      await db.execute('DELETE FROM iam_permission WHERE app_code = ?', [created.appCode]);
      await db.execute('DELETE FROM iam_role WHERE app_code = ?', [created.appCode]);
      await db.execute('DELETE FROM iam_oauth_client WHERE app_code = ?', [created.appCode]);
      await db.execute('DELETE FROM iam_app WHERE id = ?', [created.appId]);
    } finally { await db.end(); }
  });
  server = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: { ...process.env, IAM_BOOTSTRAP_PASSWORD: 'ChangeMe123!', IAM_BOOTSTRAP_USERNAME: 'iam_admin', PORT: String(port) },
    stdio: 'ignore',
  });
  await waitForHealth();

  const login = await fetch(`${baseUrl}/auth/login`, { body: JSON.stringify({ password: 'ChangeMe123!', username: 'iam_admin' }), headers: { 'content-type': 'application/json' }, method: 'POST' });
  const { accessToken } = await login.json();
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const appCode = `resource_${suffix}`;
  const app = await request('/iam/admin/apps', accessToken, { body: JSON.stringify({ appCode, appName: 'Resource test app' }), method: 'POST' });
  created = { appCode, appId: app.id };

  const renamedApp = await fetch(`${baseUrl}/iam/admin/apps/${app.id}`, {
    body: JSON.stringify({ appCode: `${appCode}_renamed`, appName: 'Renamed resource app' }),
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    method: 'PUT',
  });
  assert.equal(renamedApp.status, 400);
  const updatedApp = await request(`/iam/admin/apps/${app.id}`, accessToken, {
    body: JSON.stringify({ appCode, appName: 'Updated resource app', companySourceSystem: 'resource_source', status: 1 }),
    method: 'PUT',
  });
  assert.deepEqual({ appCode: updatedApp.appCode, companySourceSystem: updatedApp.companySourceSystem }, { appCode, companySourceSystem: 'resource_source' });

  const client = await request(`/iam/admin/apps/${appCode}/clients`, accessToken, {
    body: JSON.stringify({ clientId: `resource_client_${suffix}`, clientType: 'public', grantTypes: ['authorization_code', 'refresh_token'], redirectUris: ['https://resource.example.test/callback'] }),
    method: 'POST',
  });
  const role = await request(`/iam/admin/apps/${appCode}/roles`, accessToken, { body: JSON.stringify({ roleCode: 'resource_reader', roleName: 'Resource reader' }), method: 'POST' });
  const permission = await request(`/iam/admin/apps/${appCode}/permissions`, accessToken, { body: JSON.stringify({ permissionCode: 'Resource:Read', permissionName: 'Resource read' }), method: 'POST' });
  const menu = await request(`/iam/admin/apps/${appCode}/menus`, accessToken, { body: JSON.stringify({ authCode: 'Resource:Read', menuName: 'Resource', path: '/resource', sortOrder: 1 }), method: 'POST' });
  const childMenu = await request(`/iam/admin/apps/${appCode}/menus`, accessToken, { body: JSON.stringify({ menuName: 'Resource child', parentId: menu.id, path: '/resource/child', sortOrder: 2 }), method: 'POST' });
  const circularMenu = await fetch(`${baseUrl}/iam/admin/apps/${appCode}/menus/${menu.id}`, {
    body: JSON.stringify({ menuName: menu.menuName, menuType: menu.menuType, parentId: childMenu.id, sortOrder: menu.sortOrder, status: 1 }),
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    method: 'PUT',
  });
  assert.equal(circularMenu.status, 400);

  const updatedClient = await request(`/iam/admin/apps/${appCode}/clients/${client.id}`, accessToken, {
    body: JSON.stringify({ accessTokenTtl: 600, clientId: client.clientId, clientType: 'public', grantTypes: ['authorization_code', 'refresh_token'], redirectUris: ['https://resource.example.test/updated-callback'], refreshTokenTtl: 7200, status: 0 }),
    method: 'PUT',
  });
  const updatedRole = await request(`/iam/admin/apps/${appCode}/roles/${role.id}`, accessToken, { body: JSON.stringify({ remark: 'disabled for test', roleCode: role.roleCode, roleName: 'Updated resource reader', roleType: 'custom', status: 0 }), method: 'PUT' });
  const updatedPermission = await request(`/iam/admin/apps/${appCode}/permissions/${permission.id}`, accessToken, { body: JSON.stringify({ permissionCode: permission.permissionCode, permissionName: 'Updated resource read', resourceType: 'api', status: 0 }), method: 'PUT' });
  const updatedMenu = await request(`/iam/admin/apps/${appCode}/menus/${menu.id}`, accessToken, { body: JSON.stringify({ authCode: 'Resource:Read', menuName: 'Updated resource', menuType: 'menu', path: '/updated-resource', sortOrder: 2, status: 0 }), method: 'PUT' });

  assert.deepEqual({ clientId: updatedClient.clientId, status: updatedClient.status }, { clientId: client.clientId, status: 0 });
  assert.deepEqual({ roleCode: updatedRole.roleCode, roleName: updatedRole.roleName, status: updatedRole.status }, { roleCode: role.roleCode, roleName: 'Updated resource reader', status: 0 });
  assert.deepEqual({ permissionCode: updatedPermission.permissionCode, permissionName: updatedPermission.permissionName, status: updatedPermission.status }, { permissionCode: permission.permissionCode, permissionName: 'Updated resource read', status: 0 });
  assert.deepEqual({ menuName: updatedMenu.menuName, path: updatedMenu.path, status: updatedMenu.status }, { menuName: 'Updated resource', path: '/updated-resource', status: 0 });

  const clients = await request(`/iam/admin/apps/${appCode}/clients`, accessToken);
  const roles = await request(`/iam/admin/apps/${appCode}/roles`, accessToken);
  const permissions = await request(`/iam/admin/apps/${appCode}/permissions`, accessToken);
  const menus = await request(`/iam/admin/apps/${appCode}/menus`, accessToken);
  assert.equal(clients.items[0].status, 0);
  assert.equal(roles.items[0].status, 0);
  assert.equal(permissions.items[0].status, 0);
  assert.equal(menus.items[0].status, 0);
});
