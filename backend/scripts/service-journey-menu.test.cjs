const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ensureMenus, MENUS } = require('./apply-service-journey-menu.cjs');
function fixture() {
  const rows = [
    { id: '1', name: 'enterprise', status: 1, parent_id: null },
    { id: '2', name: 'enterprise-profile', component: 'enterprise/profile/list', path: 'profile', parent_id: '1', auth_code: 'Enterprise:Profile:List', status: 1 },
  ];
  const writes = [];
  return { rows, writes, async query(sql, args) {
    if (sql.startsWith('SELECT')) return [rows.map(row => ({ ...row }))];
    writes.push(sql);
    if (sql.startsWith('UPDATE')) {
      const row = rows.find(row => row.id === args[1]);
      row[sql.includes('SET name') ? 'name' : 'title'] = args[0];
      return [{ affectedRows: 1 }];
    }
    assert.ok(sql.startsWith('INSERT INTO sys_menu'));
    const [portal_type, app_code, parent_id, name, path, component, redirect_path, menu_type, title, order_num, status, auth_code] = args;
    const id = String(rows.length + 1);
    rows.push({ id, portal_type, app_code, parent_id, name, path, component, redirect_path, menu_type, title, order_num, status, auth_code });
    return [{ insertId: id }];
  } };
}
test('dry run describes dependencies without writing', async () => {
  const db = fixture();
  const result = await ensureMenus(db, 'kjqb', false);
  assert.equal(result.changes.length, MENUS.length + 1);
  assert.equal(db.writes.length, 0);
  assert.equal(db.rows.length, 2);
});
test('legacy initialization preserves list ID, URL and permissions and is idempotent', async () => {
  const db = fixture();
  await ensureMenus(db, 'kjqb', true);
  assert.equal(db.rows[1].name, 'EnterpriseProfileList');
  assert.equal(db.rows[1].path, 'profile');
  assert.equal(db.rows[1].id, '2');
  assert.equal(db.rows[1].auth_code, 'Enterprise:Profile:List');
  assert.ok(db.rows.slice(2).every(row => row.auth_code === 'Enterprise:Profile:List'));
  assert.equal((await ensureMenus(db, 'kjqb', true)).changes.length, 0);
  assert.equal(db.rows.length, MENUS.length + 2);
  assert.ok(db.writes.every(sql => !sql.includes('sys_role') && !sql.includes('SET auth_code')));
});
test('disabled enterprise list is never re-enabled', async () => {
  const db = fixture(); db.rows[1].status = 0;
  await assert.rejects(ensureMenus(db, 'kjqb', true), /停用/);
  assert.equal(db.writes.length, 0);
});
test('permission mismatches are rejected before changes', async () => {
  const db = fixture(); db.rows[1].auth_code = 'Other:Scope';
  await assert.rejects(ensureMenus(db, 'kjqb', true), /权限/);
  assert.equal(db.writes.length, 0);
});
test('generic material routes are hidden but still permission filtered', async () => {
  const { MenuService } = require('../dist/modules/menu/menu.service.js');
  const service = new MenuService({}, {});
  const row = { id: '1', name: 'EnterpriseMaterialSection', path: ':section', portalType: 'admin', parentId: null, menuType: 'menu', title: '企业资料', status: 1, authCode: 'Enterprise:Profile:List' };
  const tree = service.buildTree([row]);
  assert.equal(tree[0].meta.hideInMenu, true);
  assert.equal(service.filterTreeByPermissions(tree, []).length, 0);
  assert.equal(service.filterTreeByPermissions(tree, ['Enterprise:Profile:List']).length, 1);
});
