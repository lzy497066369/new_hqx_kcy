#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const MENU_NAMES = [
  'EnterpriseServiceStatistics',
  'EnterpriseProfileList',
  'EnterpriseMaterialLedger',
  'EnterpriseDeclarationManagement',
  'EnterpriseDeclarationList',
  'EnterpriseDeclarationDetail',
  'EnterpriseWorkspace',
  'EnterpriseWorkspaceProfile',
  'EnterpriseWorkspaceFinance',
  'EnterpriseWorkspaceEmployees',
  'EnterpriseWorkspaceProperties',
  'EnterpriseWorkspaceResearch',
  'EnterpriseWorkspaceProductServices',
  'EnterpriseWorkspaceTransformations',
  'EnterpriseWorkspaceEvidenceChain',
  'EnterpriseWorkspaceArchiveRecords',
  'EnterpriseWorkspaceDeclarations',
  'EnterpriseWorkspaceTodos',
];

const MATERIAL_MENU_NAMES = [
  'EnterpriseMaterialOverview',
  'EnterpriseMaterialBasic',
  'EnterpriseMaterialFinance',
  'EnterpriseMaterialEmployees',
  'EnterpriseMaterialProperties',
  'EnterpriseMaterialContracts',
  'EnterpriseMaterialDocuments',
  'EnterpriseMaterialCertificates',
  'EnterpriseMaterialPhotos',
  'EnterpriseMaterialAccounts',
];

const MATERIAL_MENU_ORDER = [
  'EnterpriseMaterialOverview',
  'EnterpriseMaterialBasic',
  'EnterpriseMaterialEmployees',
  'EnterpriseMaterialFinance',
  'EnterpriseMaterialContracts',
  'EnterpriseMaterialProperties',
  'EnterpriseMaterialDocuments',
  'EnterpriseMaterialCertificates',
  'EnterpriseMaterialPhotos',
  'EnterpriseMaterialAccounts',
];

const EXPECTED_TITLES = {
  EnterpriseDeclarationDetail: '申报详情',
  EnterpriseDeclarationList: '申报列表',
  EnterpriseDeclarationManagement: '企业申报管理',
  EnterpriseMaterialLedger: '企业材料台账',
  EnterpriseProfileList: '企业列表',
  EnterpriseServiceStatistics: '企业管理',
  EnterpriseWorkspace: '企业管理',
};

function loadEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index < 1 || line.trim().startsWith('#')) continue;
    env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return env;
}

async function main() {
  const env = { ...loadEnv(path.join(__dirname, '..', '.env')), ...process.env };
  const connection = await mysql.createConnection({
    database: env.DB_DATABASE,
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: Number(env.DB_PORT ?? 3306),
    user: env.DB_USERNAME,
  });
  try {
    const [rows] = await connection.query(
      `SELECT name, parent_id, path, portal_type, auth_code, title, order_num FROM sys_menu WHERE name IN (${[...MENU_NAMES, ...MATERIAL_MENU_NAMES].map(() => '?').join(', ')})`,
      [...MENU_NAMES, ...MATERIAL_MENU_NAMES],
    );
    const byName = new Map(rows.map((row) => [row.name, row]));
    const missing = [...MENU_NAMES, ...MATERIAL_MENU_NAMES].filter((name) => !byName.has(name));
    if (missing.length) throw new Error(`Missing menu entries: ${missing.join(', ')}`);
    const invalid = [...MENU_NAMES, ...MATERIAL_MENU_NAMES].filter((name) => {
      const row = byName.get(name);
      return row.portal_type !== 'admin' || row.auth_code !== 'Enterprise:Profile:List';
    });
    if (invalid.length) throw new Error(`Invalid menu scope: ${invalid.join(', ')}`);
    const invalidTitles = Object.entries(EXPECTED_TITLES)
      .filter(([name, title]) => byName.get(name).title !== title)
      .map(([name]) => name);
    if (invalidTitles.length) {
      throw new Error(`Invalid enterprise menu titles: ${invalidTitles.join(', ')}`);
    }
    if (byName.get('EnterpriseServiceStatistics').parent_id !== null) {
      throw new Error('Enterprise management menu is not a root');
    }
    const [statistics] = await connection.query('SELECT id FROM sys_menu WHERE name = ? LIMIT 1', ['EnterpriseServiceStatistics']);
    const [declarations] = await connection.query('SELECT id FROM sys_menu WHERE name = ? LIMIT 1', ['EnterpriseDeclarationManagement']);
    if (!statistics.length || !declarations.length) throw new Error('Missing enterprise top-level menu');
    if (String(byName.get('EnterpriseProfileList').parent_id) !== String(statistics[0].id)) throw new Error('Enterprise profile list is detached from statistics');
    const detachedManagementMenus = ['EnterpriseMaterialLedger', 'EnterpriseDeclarationManagement'].filter(
      (name) => String(byName.get(name).parent_id) !== String(statistics[0].id),
    );
    if (detachedManagementMenus.length) {
      throw new Error(`Detached enterprise management menus: ${detachedManagementMenus.join(', ')}`);
    }
    if (String(byName.get('EnterpriseDeclarationList').parent_id) !== String(declarations[0].id)) throw new Error('Enterprise declaration list is detached from declaration management');
    const [materials] = await connection.query('SELECT id FROM sys_menu WHERE name = ? LIMIT 1', ['EnterpriseMaterialLedger']);
    if (!materials.length) throw new Error('Missing enterprise material ledger menu');
    const detachedMaterials = MATERIAL_MENU_NAMES.filter(
      (name) => String(byName.get(name).parent_id) !== String(materials[0].id),
    );
    if (detachedMaterials.length) {
      throw new Error(`Detached enterprise material menus: ${detachedMaterials.join(', ')}`);
    }
    const invalidMaterialOrder = MATERIAL_MENU_ORDER.filter(
      (name, index) => Number(byName.get(name).order_num) !== index + 1,
    );
    if (invalidMaterialOrder.length) {
      throw new Error(`Invalid enterprise material menu order: ${invalidMaterialOrder.join(', ')}`);
    }
    const [hiddenMenus] = await connection.query(
      'SELECT name FROM sys_menu WHERE portal_type = ? AND name IN (?, ?)',
      ['admin', 'EnterpriseMaterialContacts', 'EnterpriseMaterialTemplates'],
    );
    if (hiddenMenus.length) {
      throw new Error(`Hidden enterprise material menus still exist: ${hiddenMenus.map((item) => item.name).join(', ')}`);
    }
    console.log(`Enterprise workspace menu database verification passed (${MENU_NAMES.length + MATERIAL_MENU_NAMES.length} entries).`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
