#!/usr/bin/env node
/** Add only the journey's navigation dependencies; never grants permissions. */
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const AUTH_CODE = 'Enterprise:Profile:List';
const MENUS = [
  ['EnterpriseMaterialLedger', '/enterprise-material-ledger', null, '企业材料台账', 'catalog', '/enterprise-material-ledger/company'],
  ['EnterpriseMaterialOverview', 'company', 'enterprise/workspace/materials/index', '公司资料', 'menu', null, 'EnterpriseMaterialLedger'],
  ['EnterpriseMaterialSection', ':section', 'enterprise/workspace/materials/index', '企业资料', 'menu', null, 'EnterpriseMaterialLedger'],
  ['EnterpriseWorkspace', '/enterprise-service-center/:enterpriseId/workspace', 'enterprise/workspace/index', '企业服务进度'],
  ['EnterpriseWorkspaceDeclarations', '/enterprise-service-center/:enterpriseId/declarations', 'enterprise/workspace/declarations/index', '企业申报工作台'],
  ['EnterpriseWorkspaceTodos', '/enterprise-service-center/:enterpriseId/todos', 'enterprise/workspace/todos/index', '审核与协同待办'],
  ['EnterpriseWorkspaceEvidenceChain', '/enterprise-service-center/:enterpriseId/evidence-chain', 'enterprise/workspace/evidence-chain/index', '证据链总览'],
  ['EnterpriseDeclarationList', '/enterprise-declaration-management/declarations', 'enterprise/declarations/list', '申报列表'],
  ['EnterpriseDeclarationDetail', '/enterprise-declaration-management/declarations/:enterpriseId/:declarationId', 'enterprise/declarations/detail', '申报详情'],
];
function loadEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i < 1 || line.trim().startsWith('#')) continue;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return env;
}
async function ensureMenus(connection, appCode, apply) {
  const [rows] = await connection.query(
    'SELECT * FROM sys_menu WHERE portal_type = ? AND app_code = ? FOR UPDATE', ['admin', appCode],
  );
  const names = new Map(rows.map(row => [row.name, row]));
  const profile = names.get('EnterpriseProfileList') ?? rows.find(row => row.component === 'enterprise/profile/list');
  if (!profile || !profile.parent_id) throw new Error('未找到现有企业列表及其父菜单，拒绝猜测菜单树');
  if (profile.auth_code !== AUTH_CODE) throw new Error('现有企业列表权限与服务进度不一致，请人工核对；未修改权限');
  const root = rows.find(row => String(row.id) === String(profile.parent_id));
  if (!root || root.status !== 1 || profile.status !== 1) throw new Error('企业列表或父菜单已停用，拒绝自动启用');
  const changes = [];
  if (profile.name !== 'EnterpriseProfileList') {
    changes.push(`保留企业列表 ID/路径/权限，路由名 ${profile.name} → EnterpriseProfileList`);
    if (apply) await connection.query('UPDATE sys_menu SET name = ?, updated_at = NOW() WHERE id = ?', ['EnterpriseProfileList', profile.id]);
  }
  for (const [name, routePath, component, title, type = 'menu', redirect = null, parentName] of MENUS) {
    const existing = names.get(name);
    if (existing) {
      if (existing.auth_code !== AUTH_CODE || existing.status !== 1 || (component && existing.component !== component))
        throw new Error(`${name} 的组件、权限或启用状态冲突，已回滚，请人工核对`);
      if (name === 'EnterpriseWorkspace' && existing.title !== title) {
        changes.push(`更新 ${name} 标题为 ${title}`);
        if (apply) await connection.query('UPDATE sys_menu SET title = ?, updated_at = NOW() WHERE id = ?', [title, existing.id]);
      }
      continue;
    }
    const parent = parentName ? names.get(parentName) : root;
    if (!parent) throw new Error(`${name} 缺少父菜单 ${parentName}`);
    changes.push(`补充路由 ${name}`);
    if (apply) {
      const [result] = await connection.query(
        `INSERT INTO sys_menu (portal_type, app_code, parent_id, name, path, component, redirect_path, menu_type, title, order_num, status, auth_code, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        ['admin', appCode, parent.id, name, routePath, component, redirect, type, title, 20 + MENUS.findIndex(item => item[0] === name), 1, AUTH_CODE],
      );
      names.set(name, { id: result.insertId });
    } else names.set(name, { id: `planned:${name}` });
  }
  return { changes, snapshot: rows };
}
async function main() {
  const env = { ...loadEnv(path.join(__dirname, '..', '.env')), ...process.env };
  const apply = process.argv.includes('--apply');
  if (apply && !['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST))
    throw new Error('此脚本只允许直接修改本地数据库；远端环境请由运维审核后执行');
  const connection = await mysql.createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT ?? 3306), user: env.DB_USERNAME, password: env.DB_PASSWORD, database: env.DB_DATABASE, charset: 'utf8mb4', supportBigNumbers: true, bigNumberStrings: true });
  try {
    await connection.beginTransaction();
    const result = await ensureMenus(connection, env.AUTH_APP_CODE || 'kjqb', apply);
    if (apply && result.changes.length) {
      const backup = path.join(require('node:os').tmpdir(), `hqx-service-journey-menu-${Date.now()}.json`);
      fs.writeFileSync(backup, JSON.stringify(result.snapshot, null, 2), { mode: 0o600 });
      console.log(`修改前菜单快照：${backup}`);
    }
    if (apply) await connection.commit(); else await connection.rollback();
    console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', changes: result.changes, permissionsChanged: false }, null, 2));
  } catch (error) { await connection.rollback(); throw error; }
  finally { await connection.end(); }
}
module.exports = { ensureMenus, MENUS };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
