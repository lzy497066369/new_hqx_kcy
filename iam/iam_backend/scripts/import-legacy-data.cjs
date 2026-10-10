const path = require('node:path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: process.env.IAM_ENV_FILE || path.resolve(rootDir, '..', '..', 'backend', '.env') });

const apply = process.argv.includes('--apply');
const legacyDatabase = process.env.LEGACY_DB_DATABASE || process.env.DB_DATABASE;
const iamDatabase = process.env.IAM_DB_DATABASE || 'iam_sso';
const sourceSystem = process.env.IAM_LEGACY_SOURCE_SYSTEM || legacyDatabase;

if (!legacyDatabase || !/^[A-Za-z0-9_]+$/.test(legacyDatabase) || !/^[A-Za-z0-9_]+$/.test(iamDatabase)) {
  throw new Error('Legacy and IAM database names must contain only letters, digits, and underscores');
}

const legacyOptions = {
  database: legacyDatabase,
  host: process.env.LEGACY_DB_HOST || process.env.DB_HOST || '127.0.0.1',
  password: process.env.LEGACY_DB_PASSWORD || process.env.DB_PASSWORD,
  port: Number(process.env.LEGACY_DB_PORT || process.env.DB_PORT || 3306),
  user: process.env.LEGACY_DB_USERNAME || process.env.DB_USERNAME || 'root',
};
const iamOptions = {
  database: iamDatabase,
  host: process.env.IAM_DB_HOST || '127.0.0.1',
  password: process.env.IAM_DB_PASSWORD,
  port: Number(process.env.IAM_DB_PORT || 3306),
  user: process.env.IAM_DB_USERNAME || 'root',
};

const apps = [
  { appCode: 'kjqb_admin', appName: '科创企服管理端', homePath: '/dashboard', portalType: 'admin', companySourceSystem: sourceSystem },
  { appCode: 'kjqb_client', appName: '科创企服客户端', homePath: '/dashboard/workspace', portalType: 'client', companySourceSystem: sourceSystem },
];
const appForPortal = { admin: 'kjqb_admin', client: 'kjqb_client' };

const placeholder = (count) => Array.from({ length: count }, () => '?').join(', ');

async function queryRows(connection, sql, params = []) {
  const [rows] = await connection.execute(sql, params);
  return rows;
}

async function loadLegacy(source) {
  const [users, roles, permissions, menus, userRoles, rolePermissions, departments, enterprises, owners, members, teachers] = await Promise.all([
    queryRows(source, 'SELECT * FROM sys_user ORDER BY id'),
    queryRows(source, 'SELECT * FROM sys_role ORDER BY id'),
    queryRows(source, 'SELECT * FROM sys_permission ORDER BY id'),
    queryRows(source, 'SELECT * FROM sys_menu ORDER BY id'),
    queryRows(source, 'SELECT * FROM sys_user_role ORDER BY id'),
    queryRows(source, 'SELECT * FROM sys_role_permission ORDER BY id'),
    queryRows(source, 'SELECT * FROM sys_dept ORDER BY id'),
    queryRows(source, 'SELECT * FROM biz_enterprise ORDER BY id'),
    queryRows(source, 'SELECT * FROM biz_enterprise_owner WHERE status = 1 ORDER BY id'),
    queryRows(source, 'SELECT * FROM biz_enterprise_user WHERE status = 1 ORDER BY id'),
    queryRows(source, 'SELECT * FROM biz_enterprise_teacher WHERE status = 1 ORDER BY id'),
  ]);
  return { departments, enterprises, members, menus, owners, permissions, rolePermissions, roles, teachers, userRoles, users };
}

function summary(data) {
  return {
    companies: data.enterprises.length,
    companyMembers: data.owners.length + data.members.length + data.teachers.length,
    platformDepartments: data.departments.length,
    menus: data.menus.length,
    permissions: data.permissions.length,
    rolePermissions: data.rolePermissions.length,
    roles: data.roles.length,
    userRoles: data.userRoles.length,
    users: data.users.length,
  };
}

async function upsertApp(target, app) {
  await target.execute(
    `INSERT INTO iam_app (app_code, app_name, app_type, portal_type, company_source_system, home_path, status, remark, created_at, updated_at)
     VALUES (?, ?, 'web', ?, ?, ?, 1, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE app_name = VALUES(app_name), app_type = VALUES(app_type), portal_type = VALUES(portal_type), company_source_system = VALUES(company_source_system), home_path = VALUES(home_path), status = VALUES(status), remark = VALUES(remark), updated_at = NOW()`,
    [app.appCode, app.appName, app.portalType, app.companySourceSystem, app.homePath, `Imported from ${sourceSystem}`],
  );
}

async function upsertOAuthClient(target, appCode, clientId, redirectUri) {
  await target.execute(
    `INSERT INTO iam_oauth_client (app_code, client_id, client_secret_hash, client_type, grant_types, redirect_uris, post_logout_redirect_uris, access_token_ttl, refresh_token_ttl, status, created_at, updated_at)
     VALUES (?, ?, NULL, 'public', ?, ?, ?, 1800, 2592000, 1, NOW(), NOW())
     ON DUPLICATE KEY UPDATE app_code = VALUES(app_code), client_type = VALUES(client_type), grant_types = VALUES(grant_types), redirect_uris = VALUES(redirect_uris), post_logout_redirect_uris = VALUES(post_logout_redirect_uris), status = VALUES(status), updated_at = NOW()`,
    [appCode, clientId, JSON.stringify(['authorization_code', 'refresh_token']), JSON.stringify([redirectUri]), JSON.stringify([redirectUri.replace('/auth/callback', '/')])],
  );
}

async function upsertUsers(target, users) {
  for (const user of users) {
    await target.execute(
      `INSERT INTO iam_user (username, password_hash, real_name, phone, email, avatar_path, status, password_changed_at, last_login_at, remark, source_system, source_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE password_hash = IF(password_hash LIKE 'scrypt$%', password_hash, VALUES(password_hash)), real_name = VALUES(real_name), phone = VALUES(phone), email = VALUES(email), avatar_path = VALUES(avatar_path), status = VALUES(status), remark = VALUES(remark), source_system = VALUES(source_system), source_user_id = VALUES(source_user_id), updated_at = NOW()`,
      [user.username, user.password, user.real_name, user.phone || null, user.email || null, user.avatar_path || null, user.status, user.updated_at || null, user.remark || null, sourceSystem, String(user.id)],
    );
  }
  return new Map((await queryRows(target, 'SELECT id, username FROM iam_user WHERE username IN (' + placeholder(users.length) + ')', users.map((user) => user.username))).map((row) => [row.username, String(row.id)]));
}

async function upsertPlatformDepartments(target, data, userByUsername) {
  const imported = new Map();
  const usersBySourceId = new Map(data.users.map((user) => [String(user.id), user]));
  for (const department of data.departments) {
    const sourceDepartmentId = String(department.id);
    const leader = department.leader_user_id ? usersBySourceId.get(String(department.leader_user_id)) : null;
    const leaderUserId = leader ? userByUsername.get(leader.username) || null : null;
    const existing = await queryRows(target, 'SELECT id FROM iam_platform_department WHERE source_system = ? AND source_department_id = ? LIMIT 1', [sourceSystem, sourceDepartmentId]);
    const values = [`legacy_${sourceDepartmentId}`, department.name, leaderUserId, department.sort_num || 0, department.status, department.remark || null, sourceSystem, sourceDepartmentId];
    if (existing[0]) {
      await target.execute('UPDATE iam_platform_department SET dept_code = ?, dept_name = ?, leader_user_id = ?, sort_order = ?, status = ?, remark = ?, updated_at = NOW() WHERE id = ?', [...values.slice(0, 6), String(existing[0].id)]);
      imported.set(sourceDepartmentId, String(existing[0].id));
    } else {
      const [result] = await target.execute('INSERT INTO iam_platform_department (parent_id, dept_code, dept_name, leader_user_id, sort_order, status, remark, source_system, source_department_id, created_at, updated_at) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())', values);
      imported.set(sourceDepartmentId, String(result.insertId));
    }
  }
  for (const department of data.departments) {
    const targetId = imported.get(String(department.id));
    const parentId = department.parent_id ? imported.get(String(department.parent_id)) || null : null;
    if (targetId) await target.execute('UPDATE iam_platform_department SET parent_id = ?, updated_at = NOW() WHERE id = ?', [parentId, targetId]);
  }
  for (const user of data.users) {
    if (!user.dept_id) continue;
    const departmentId = imported.get(String(user.dept_id));
    const userId = userByUsername.get(user.username);
    if (!departmentId || !userId) continue;
    await target.execute('INSERT INTO iam_user_platform_department (department_id, user_id, is_primary, status, created_at, updated_at) VALUES (?, ?, 1, 1, NOW(), NOW()) ON DUPLICATE KEY UPDATE is_primary = 1, status = 1, updated_at = NOW()', [departmentId, userId]);
  }
}

async function upsertRolesAndPermissions(target, data) {
  for (const role of data.roles) {
    const appCode = appForPortal[role.portal_type];
    if (!appCode || (role.portal_type === 'client' && role.code === 'region_leader')) continue;
    await target.execute(
      `INSERT INTO iam_role (app_code, role_code, role_name, role_type, status, remark, created_at, updated_at)
       VALUES (?, ?, ?, 'legacy', ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE role_name = VALUES(role_name), status = VALUES(status), remark = VALUES(remark), updated_at = NOW()`,
      [appCode, role.code, role.name, role.status, role.remark || null],
    );
  }
  for (const permission of data.permissions) {
    const appCode = appForPortal[permission.portal_type];
    if (!appCode) continue;
    await target.execute(
      `INSERT INTO iam_permission (app_code, permission_code, permission_name, resource_type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE permission_name = VALUES(permission_name), resource_type = VALUES(resource_type), status = VALUES(status), updated_at = NOW()`,
      [appCode, permission.code, permission.name, permission.type, permission.status],
    );
  }
  const knownPermissions = new Set(data.permissions.map((permission) => `${permission.portal_type}:${permission.code}`));
  const menuPermissions = new Map();
  for (const menu of data.menus) {
    const appCode = appForPortal[menu.portal_type];
    const permissionCode = menu.auth_code?.trim();
    if (!appCode || !permissionCode || knownPermissions.has(`${menu.portal_type}:${permissionCode}`)) continue;
    menuPermissions.set(`${appCode}:${permissionCode}`, { appCode, permissionCode, permissionName: menu.title || menu.name, status: menu.status });
  }
  for (const permission of menuPermissions.values()) {
    await target.execute(
      `INSERT INTO iam_permission (app_code, permission_code, permission_name, resource_type, status, created_at, updated_at)
       VALUES (?, ?, ?, 'menu', ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE permission_name = VALUES(permission_name), resource_type = 'menu', status = VALUES(status), updated_at = NOW()`,
      [permission.appCode, permission.permissionCode, permission.permissionName, permission.status],
    );
  }

  // The legacy system allowed admin-side project teachers into the client portal.
  await target.execute(
    `INSERT INTO iam_role (app_code, role_code, role_name, role_type, status, remark, created_at, updated_at)
     VALUES ('kjqb_client', 'project_teacher', '项目老师', 'legacy', 1, 'Legacy cross-portal compatibility role', NOW(), NOW())
     ON DUPLICATE KEY UPDATE role_name = VALUES(role_name), status = 1, updated_at = NOW()`,
  );
  // Two business personas used by the consolidated client login and workspaces.
  for (const [roleCode, roleName, remark] of [
    ['enterprise_leader', '企业负责人', 'Enterprise workflow owner'],
    ['global_leader', '总负责人', 'Direct enterprise-account and archive management'],
  ]) {
    await target.execute(
      `INSERT INTO iam_role (app_code, role_code, role_name, role_type, status, remark, created_at, updated_at)
       VALUES ('kjqb_client', ?, ?, 'business', 1, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE role_name = VALUES(role_name), status = 1, remark = VALUES(remark), updated_at = NOW()`,
      [roleCode, roleName, remark],
    );
  }

  const roleRows = await queryRows(target, 'SELECT id, app_code, role_code FROM iam_role WHERE app_code IN (?, ?)', apps.map((app) => app.appCode));
  const permissionRows = await queryRows(target, 'SELECT id, app_code, permission_code FROM iam_permission WHERE app_code IN (?, ?)', apps.map((app) => app.appCode));
  const roleByKey = new Map(roleRows.map((row) => [`${row.app_code}:${row.role_code}`, String(row.id)]));
  const permissionByKey = new Map(permissionRows.map((row) => [`${row.app_code}:${row.permission_code}`, String(row.id)]));
  const sourceRoles = new Map(data.roles.map((role) => [String(role.id), role]));
  const sourcePermissions = new Map(data.permissions.map((permission) => [String(permission.id), permission]));

  for (const relation of data.rolePermissions) {
    const sourceRole = sourceRoles.get(String(relation.role_id));
    const sourcePermission = sourcePermissions.get(String(relation.permission_id));
    if (!sourceRole || !sourcePermission || sourceRole.portal_type !== sourcePermission.portal_type) continue;
    const appCode = appForPortal[sourceRole.portal_type];
    const roleId = roleByKey.get(`${appCode}:${sourceRole.code}`);
    const permissionId = permissionByKey.get(`${appCode}:${sourcePermission.code}`);
    if (!roleId || !permissionId) continue;
    await target.execute('INSERT INTO iam_role_permission (role_id, permission_id, created_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)', [roleId, permissionId]);
  }
  const projectTeacherRoleId = roleByKey.get('kjqb_client:project_teacher');
  if (projectTeacherRoleId) {
    const clientPermissionIds = permissionRows
      .filter((row) => row.app_code === 'kjqb_client')
      .map((row) => String(row.id));
    for (const permissionId of clientPermissionIds) {
      await target.execute('INSERT INTO iam_role_permission (role_id, permission_id, created_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)', [projectTeacherRoleId, permissionId]);
    }
  }
  return { permissionByKey, roleByKey, sourcePermissions, sourceRoles };
}

async function upsertUserAccess(target, data, userByUsername, maps) {
  const sourceUsers = new Map(data.users.map((user) => [String(user.id), user]));
  const roleAssignments = [];
  for (const relation of data.userRoles) {
    const sourceUser = sourceUsers.get(String(relation.user_id));
    const sourceRole = maps.sourceRoles.get(String(relation.role_id));
    if (!sourceUser || !sourceRole || (sourceRole.portal_type === 'client' && sourceRole.code === 'region_leader')) continue;
    const appCode = appForPortal[sourceRole.portal_type];
    const userId = userByUsername.get(sourceUser.username);
    const roleId = maps.roleByKey.get(`${appCode}:${sourceRole.code}`);
    if (!userId || !roleId) continue;
    roleAssignments.push({ appCode, roleId, sourceRole, sourceUser, userId });
  }

  for (const assignment of roleAssignments) {
    const homePath = assignment.sourceUser.portal_type === (assignment.appCode === 'kjqb_admin' ? 'admin' : 'client')
      ? assignment.sourceUser.home_path || null
      : null;
    await target.execute(
      `INSERT INTO iam_user_app (user_id, app_code, status, home_path, created_at, updated_at)
       VALUES (?, ?, 1, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE status = VALUES(status), home_path = COALESCE(VALUES(home_path), home_path), updated_at = NOW()`,
      [assignment.userId, assignment.appCode, homePath],
    );
    await target.execute('INSERT INTO iam_user_role (user_id, app_code, role_id, created_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)', [assignment.userId, assignment.appCode, assignment.roleId]);
  }

  // Existing business behavior lets an admin-side project teacher enter the client portal.
  const teacherRoleId = maps.roleByKey.get('kjqb_client:project_teacher');
  if (teacherRoleId) {
    const adminTeachers = roleAssignments.filter((item) => item.appCode === 'kjqb_admin' && item.sourceRole.code === 'project_teacher');
    for (const item of adminTeachers) {
      await target.execute(`INSERT INTO iam_user_app (user_id, app_code, status, home_path, created_at, updated_at) VALUES (?, 'kjqb_client', 1, NULL, NOW(), NOW()) ON DUPLICATE KEY UPDATE status = 1, updated_at = NOW()`, [item.userId]);
      await target.execute('INSERT INTO iam_user_role (user_id, app_code, role_id, created_at) VALUES (?, \'kjqb_client\', ?, NOW()) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)', [item.userId, teacherRoleId]);
    }
  }
  return sourceUsers;
}

async function upsertMenus(target, menus) {
  const imported = new Map();
  for (const menu of menus) {
    const appCode = appForPortal[menu.portal_type];
    if (!appCode) continue;
    const meta = JSON.stringify({ icon: menu.icon || null, legacyMenuId: String(menu.id), legacySource: sourceSystem, title: menu.title || menu.name });
    const existing = await queryRows(target, "SELECT id FROM iam_menu WHERE app_code = ? AND JSON_UNQUOTE(JSON_EXTRACT(meta_json, '$.legacySource')) = ? AND JSON_UNQUOTE(JSON_EXTRACT(meta_json, '$.legacyMenuId')) = ? LIMIT 1", [appCode, sourceSystem, String(menu.id)]);
    if (existing[0]) {
      await target.execute('UPDATE iam_menu SET menu_name = ?, menu_type = ?, path = ?, component = ?, redirect = ?, auth_code = ?, meta_json = ?, sort_order = ?, status = ?, updated_at = NOW() WHERE id = ?', [menu.name, menu.menu_type, menu.path || null, menu.component || null, menu.redirect_path || null, menu.auth_code || null, meta, menu.order_num, menu.status, existing[0].id]);
      imported.set(String(menu.id), String(existing[0].id));
    } else {
      const [result] = await target.execute('INSERT INTO iam_menu (app_code, parent_id, menu_name, menu_type, path, component, redirect, auth_code, meta_json, sort_order, status, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())', [appCode, menu.name, menu.menu_type, menu.path || null, menu.component || null, menu.redirect_path || null, menu.auth_code || null, meta, menu.order_num, menu.status]);
      imported.set(String(menu.id), String(result.insertId));
    }
  }
  for (const menu of menus) {
    const targetId = imported.get(String(menu.id));
    const parentId = menu.parent_id ? imported.get(String(menu.parent_id)) || null : null;
    if (targetId) await target.execute('UPDATE iam_menu SET parent_id = ?, updated_at = NOW() WHERE id = ?', [parentId, targetId]);
  }
}

async function upsertCompanies(target, data, sourceUsers, userByUsername) {
  const companyBySourceId = new Map();
  for (const enterprise of data.enterprises) {
    const existing = await queryRows(target, 'SELECT id FROM iam_company WHERE source_system = ? AND source_company_id = ? LIMIT 1', [sourceSystem, String(enterprise.id)]);
    const values = [enterprise.name, enterprise.short_name || null, enterprise.credit_code || null, enterprise.legal_person || null, enterprise.contact_name || null, enterprise.contact_phone || null, enterprise.province || null, enterprise.city || null, enterprise.district || null, enterprise.status, sourceSystem, String(enterprise.id)];
    let companyId;
    if (existing[0]) {
      companyId = String(existing[0].id);
      await target.execute('UPDATE iam_company SET company_name = ?, short_name = ?, credit_code = ?, legal_person = ?, contact_name = ?, contact_phone = ?, province = ?, city = ?, district = ?, status = ?, updated_at = NOW() WHERE id = ?', [...values.slice(0, 10), companyId]);
    } else {
      const [result] = await target.execute('INSERT INTO iam_company (company_name, short_name, credit_code, legal_person, contact_name, contact_phone, province, city, district, status, source_system, source_company_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())', values);
      companyId = String(result.insertId);
    }
    companyBySourceId.set(String(enterprise.id), companyId);
  }

  const upsertRelation = async (relation, userColumn, memberType, isDefault = 0) => {
    const legacyUser = sourceUsers.get(String(relation[userColumn]));
    const companyId = companyBySourceId.get(String(relation.enterprise_id));
    const userId = legacyUser && userByUsername.get(legacyUser.username);
    if (!companyId || !userId) return;
    await target.execute(`INSERT INTO iam_user_app (user_id, app_code, status, home_path, created_at, updated_at) VALUES (?, 'kjqb_client', 1, NULL, NOW(), NOW()) ON DUPLICATE KEY UPDATE status = 1, updated_at = NOW()`, [userId]);
    await target.execute('INSERT INTO iam_company_member (company_id, user_id, app_code, member_type, is_primary, status, created_at, updated_at) VALUES (?, ?, \'kjqb_client\', ?, ?, 1, NOW(), NOW()) ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary), status = 1, updated_at = NOW()', [companyId, userId, memberType, memberType === 'owner' ? 1 : 0]);
    await target.execute('INSERT INTO iam_user_company_scope (user_id, app_code, company_id, relation_type, data_scope, is_default, status, created_at, updated_at) VALUES (?, \'kjqb_client\', ?, ?, \'assigned\', ?, 1, NOW(), NOW()) ON DUPLICATE KEY UPDATE is_default = VALUES(is_default), status = 1, updated_at = NOW()', [userId, companyId, memberType, isDefault ? 1 : 0]);
  };
  for (const owner of data.owners) await upsertRelation(owner, 'user_id', 'owner');
  for (const member of data.members) await upsertRelation(member, 'user_id', 'employee', member.is_default);
  for (const teacher of data.teachers) await upsertRelation(teacher, 'teacher_user_id', 'project_teacher');
  return companyBySourceId;
}

async function upsertAdminAllCompanyScopes(target, data, userByUsername, companyBySourceId) {
  const companyId = companyBySourceId.values().next().value;
  if (!companyId) return;

  const rolesById = new Map(data.roles.map((role) => [String(role.id), role]));
  const usersById = new Map(data.users.map((user) => [String(user.id), user]));
  const adminUserIds = new Set(
    data.userRoles
      .filter((assignment) => rolesById.get(String(assignment.role_id))?.code === 'admin')
      .map((assignment) => String(assignment.user_id)),
  );

  for (const sourceUserId of adminUserIds) {
    const sourceUser = usersById.get(sourceUserId);
    const userId = sourceUser && userByUsername.get(sourceUser.username);
    if (!userId) continue;
    await target.execute(
      "INSERT INTO iam_user_company_scope (user_id, app_code, company_id, relation_type, data_scope, is_default, status, created_at, updated_at) VALUES (?, 'kjqb_admin', ?, 'admin', 'all', 1, 1, NOW(), NOW()) ON DUPLICATE KEY UPDATE data_scope = 'all', is_default = 1, status = 1, updated_at = NOW()",
      [userId, companyId],
    );
  }
}

async function migrate() {
  const source = await mysql.createConnection(legacyOptions);
  try {
    const data = await loadLegacy(source);
    console.log(JSON.stringify({ apply, legacyDatabase, summary: summary(data) }, null, 2));
    if (!apply) {
      console.log('Dry run complete. Re-run with --apply to write only to the IAM database.');
      return;
    }
    const target = await mysql.createConnection(iamOptions);
    try {
      await target.beginTransaction();
      for (const app of apps) await upsertApp(target, app);
      await upsertOAuthClient(target, 'kjqb_admin', 'kjqb_admin_web', process.env.IAM_ADMIN_REDIRECT_URI || 'http://localhost:5999/auth/callback');
      await upsertOAuthClient(target, 'kjqb_client', 'kjqb_client_web', process.env.IAM_CLIENT_REDIRECT_URI || 'http://localhost:5998/auth/callback');
      const userByUsername = await upsertUsers(target, data.users);
      await upsertPlatformDepartments(target, data, userByUsername);
      const maps = await upsertRolesAndPermissions(target, data);
      const sourceUsers = await upsertUserAccess(target, data, userByUsername, maps);
      await upsertMenus(target, data.menus);
      const companyBySourceId = await upsertCompanies(target, data, sourceUsers, userByUsername);
      await upsertAdminAllCompanyScopes(target, data, userByUsername, companyBySourceId);
      // Never reactivate the retired persona when re-importing old data.
      const retiredRoleIds = new Set(data.roles.filter((role) => role.portal_type === 'client' && role.code === 'region_leader').map((role) => String(role.id)));
      const retiredUserIds = new Set(data.userRoles.filter((link) => retiredRoleIds.has(String(link.role_id))).map((link) => String(link.user_id)));
      for (const user of data.users.filter((user) => retiredUserIds.has(String(user.id)))) {
        const userId = userByUsername.get(user.username);
        if (userId) await target.execute("UPDATE iam_user_app SET status = 0 WHERE user_id = ? AND app_code = 'kjqb_client'", [userId]);
      }
      await target.execute("UPDATE iam_user_app ua JOIN iam_user_role ur ON ur.user_id = ua.user_id AND ur.app_code = ua.app_code JOIN iam_role r ON r.id = ur.role_id SET ua.status = 0 WHERE r.app_code = 'kjqb_client' AND r.role_code = 'region_leader'");
      await target.execute("UPDATE iam_role SET status = 0 WHERE app_code = 'kjqb_client' AND role_code = 'region_leader'");
      await target.execute("UPDATE iam_menu SET status = 0 WHERE app_code = 'kjqb_client' AND path IN ('/governance/enterprises', '/governance/project-accounts', '/governance/region-accounts')");
      await target.commit();
      console.log(JSON.stringify({ applied: true, iamDatabase, summary: summary(data) }, null, 2));
    } catch (error) {
      await target.rollback();
      throw error;
    } finally {
      await target.end();
    }
  } finally {
    await source.end();
  }
}

migrate().catch((error) => {
  console.error(`Legacy IAM import failed: ${error.message}`);
  process.exitCode = 1;
});
