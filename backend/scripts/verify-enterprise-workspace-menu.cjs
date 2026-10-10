const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const routeFile = path.join(root, 'vue-admin', 'apps', 'web-admin', 'src', 'router', 'routes', 'modules', 'enterprise.ts');
const sqlFile = path.join(root, 'backend', 'sql', 'enterprise-top-level-menu-p2.sql');
const routes = fs.readFileSync(routeFile, 'utf8');
const sql = fs.readFileSync(sqlFile, 'utf8');
const names = [...routes.matchAll(/name:\s*'(Enterprise(?:Workspace\w+|ProfileList|MaterialLedger|Declaration(?:Management|List|Detail)|ServiceStatistics))'/g)].map((match) => match[1]);
const missing = names.filter((name) => !sql.includes(`'${name}'`));
if (missing.length) {
  throw new Error(`Enterprise workspace menu entries missing: ${missing.join(', ')}`);
}
if (!sql.includes("'admin'") || !sql.includes("'Enterprise:Profile:List'")) {
  throw new Error('Enterprise workspace menu entries must target admin portal and list permission');
}
for (const pathValue of ['/enterprise-service-statistics', '/enterprise-material-ledger', '/enterprise-declaration-management']) {
  if (!sql.includes(pathValue)) {
    throw new Error(`Enterprise top-level menu path missing: ${pathValue}`);
  }
}
console.log(`Enterprise workspace menu verification passed (${names.length} routes).`);
