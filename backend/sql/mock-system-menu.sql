-- 按前端路由模拟的系统菜单数据
-- 适用表: sys_menu
-- 建议在执行 schema.mysql56.sql 建表后再执行本文件

SET @@session.time_zone = '+08:00';

INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT
  NULL,
  'Dashboard',
  '/Dashboard',
  NULL,
  '/Dashboard/Workspace',
  'catalog',
  'lucide:layout-dashboard',
  'page.dashboard.title',
  -1,
  1,
  NULL,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_menu` WHERE `name` = 'Dashboard'
);

INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT
  NULL,
  'System',
  '/system',
  NULL,
  '/system/user',
  'catalog',
  'ion:settings-outline',
  'system.title',
  9997,
  1,
  'AC_100100',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_menu` WHERE `name` = 'System'
);

INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT
  parent.`id`,
  'Workspace',
  '/Dashboard/Workspace',
  'dashboard/workspace/index',
  NULL,
  'menu',
  'carbon:workspace',
  'page.dashboard.workspace',
  1,
  1,
  NULL,
  NOW(),
  NOW()
FROM `sys_menu` parent
WHERE parent.`name` = 'Dashboard'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `name` = 'Workspace'
  );

INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT
  parent.`id`,
  'Analytics',
  '/Dashboard/Analytics',
  'dashboard/analytics/index',
  NULL,
  'menu',
  'lucide:area-chart',
  'page.dashboard.analytics',
  2,
  1,
  NULL,
  NOW(),
  NOW()
FROM `sys_menu` parent
WHERE parent.`name` = 'Dashboard'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `name` = 'Analytics'
  );

INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT
  parent.`id`,
  'SystemUser',
  'user',
  'system/user/list',
  NULL,
  'menu',
  'mdi:user',
  'system.user.title',
  1,
  1,
  'AC_100100',
  NOW(),
  NOW()
FROM `sys_menu` parent
WHERE parent.`name` = 'System'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `name` = 'SystemUser'
  );

INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT
  parent.`id`,
  'SystemRole',
  'role',
  'system/role/list',
  NULL,
  'menu',
  'mdi:account-group',
  'system.role.title',
  2,
  1,
  'AC_100100',
  NOW(),
  NOW()
FROM `sys_menu` parent
WHERE parent.`name` = 'System'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `name` = 'SystemRole'
  );

INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT
  parent.`id`,
  'SystemMenu',
  'menu',
  'system/menu/list',
  NULL,
  'menu',
  'mdi:menu',
  'system.menu.title',
  3,
  1,
  'AC_100100',
  NOW(),
  NOW()
FROM `sys_menu` parent
WHERE parent.`name` = 'System'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `name` = 'SystemMenu'
  );

INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT
  parent.`id`,
  'SystemDept',
  'dept',
  'system/dept/list',
  NULL,
  'menu',
  'charm:organisation',
  'system.dept.title',
  4,
  1,
  'AC_100100',
  NOW(),
  NOW()
FROM `sys_menu` parent
WHERE parent.`name` = 'System'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `name` = 'SystemDept'
  );

INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT
  NULL,
  'Enterprise',
  '/enterprise',
  NULL,
  '/enterprise/profile',
  'catalog',
  'mdi:domain',
  'system.enterprise.title',
  3,
  1,
  'Enterprise:Profile:List',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_menu` WHERE `name` = 'Enterprise'
);

INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT
  parent.`id`,
  'EnterpriseProfile',
  'profile',
  'enterprise/profile/list',
  NULL,
  'menu',
  'mdi:office-building',
  'system.enterprise.profile.name',
  1,
  1,
  'Enterprise:Profile:List',
  NOW(),
  NOW()
FROM `sys_menu` parent
WHERE parent.`name` = 'Enterprise'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `name` = 'EnterpriseProfile'
  );

INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT
  parent.`id`,
  'EnterpriseOwner',
  'owner',
  'enterprise/owner/list',
  NULL,
  'menu',
  'mdi:account-tie',
  'system.enterprise.owner.name',
  2,
  1,
  'Enterprise:Owner:List',
  NOW(),
  NOW()
FROM `sys_menu` parent
WHERE parent.`name` = 'Enterprise'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `name` = 'EnterpriseOwner'
  );

INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT
  parent.`id`,
  'EnterpriseUser',
  'user',
  'enterprise/user/list',
  NULL,
  'menu',
  'mdi:account',
  'system.enterprise.user.name',
  3,
  1,
  'Enterprise:User:List',
  NOW(),
  NOW()
FROM `sys_menu` parent
WHERE parent.`name` = 'Enterprise'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `name` = 'EnterpriseUser'
  );
