-- 申报配置与政策管理菜单重组：区域管理和统一政策项目归入申报配置，区域政策文件归入政策管理。
-- 可重复执行，保留既有页面组件、路由路径及权限码。

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT 'admin', NULL, 'DeclarationConfiguration', '/declaration-configuration', NULL, '/policy/regions', 'catalog', 'lucide:settings-2', '申报配置', 190, 1, 'AC_POLICY_ROOT', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM `sys_menu`
  WHERE `portal_type` = 'admin'
    AND `name` = 'DeclarationConfiguration'
);

UPDATE `sys_menu`
SET `path` = '/declaration-configuration',
    `component` = NULL,
    `redirect_path` = '/policy/regions',
    `menu_type` = 'catalog',
    `icon` = 'lucide:settings-2',
    `title` = '申报配置',
    `order_num` = 190,
    `status` = 1,
    `auth_code` = 'AC_POLICY_ROOT'
WHERE `portal_type` = 'admin'
  AND `name` = 'DeclarationConfiguration';

UPDATE `sys_menu` legacy
LEFT JOIN `sys_menu` current
  ON current.`portal_type` = legacy.`portal_type`
  AND current.`name` = 'PolicyManagement'
SET legacy.`name` = 'PolicyManagement'
WHERE legacy.`portal_type` = 'admin'
  AND legacy.`name` = 'Policy'
  AND current.`id` IS NULL;

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT 'admin', NULL, 'PolicyManagement', '/policy', NULL, '/policy/files', 'catalog', 'lucide:shield-check', '政策管理', 200, 1, 'AC_POLICY_ROOT', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM `sys_menu`
  WHERE `portal_type` = 'admin'
    AND `name` = 'PolicyManagement'
);

UPDATE `sys_menu`
SET `parent_id` = NULL,
    `path` = '/policy',
    `component` = NULL,
    `redirect_path` = '/policy/files',
    `menu_type` = 'catalog',
    `icon` = 'lucide:shield-check',
    `title` = '政策管理',
    `order_num` = 200,
    `status` = 1,
    `auth_code` = 'AC_POLICY_ROOT'
WHERE `portal_type` = 'admin'
  AND `name` = 'PolicyManagement';

UPDATE `sys_menu` child
JOIN `sys_menu` parent
  ON parent.`portal_type` = 'admin'
  AND parent.`name` = 'DeclarationConfiguration'
SET child.`parent_id` = parent.`id`
WHERE child.`portal_type` = 'admin'
  AND child.`name` IN ('PolicyRegion', 'PolicyProject');

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.`portal_type`, parent.`id`, 'PolicyDeclarationScheme', 'declaration-schemes', 'policy/project/declaration-scheme-list', NULL, 'menu', 'lucide:workflow', '申报方案', 3, 1, 'Policy:Project:MaterialRequirement', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.`portal_type` = 'admin'
  AND parent.`name` = 'DeclarationConfiguration'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_menu`
    WHERE `portal_type` = 'admin'
      AND `name` = 'PolicyDeclarationScheme'
  );

UPDATE `sys_menu` child
JOIN `sys_menu` parent
  ON parent.`portal_type` = 'admin'
  AND parent.`name` = 'DeclarationConfiguration'
SET child.`parent_id` = parent.`id`,
    child.`path` = 'declaration-schemes',
    child.`component` = 'policy/project/declaration-scheme-list',
    child.`redirect_path` = NULL,
    child.`menu_type` = 'menu',
    child.`icon` = 'lucide:workflow',
    child.`title` = '申报方案',
    child.`order_num` = 3,
    child.`status` = 1,
    child.`auth_code` = 'Policy:Project:MaterialRequirement'
WHERE child.`portal_type` = 'admin'
  AND child.`name` = 'PolicyDeclarationScheme';

UPDATE `sys_menu`
SET `path` = 'files',
    `component` = 'policy/file/list',
    `redirect_path` = NULL,
    `menu_type` = 'menu',
    `icon` = 'lucide:file-text',
    `title` = '区域政策文件',
    `order_num` = 1,
    `status` = 1,
    `auth_code` = 'Policy:File:List'
WHERE `portal_type` = 'admin'
  AND `name` = 'PolicyFile';

UPDATE `sys_menu` child
JOIN `sys_menu` parent
  ON parent.`portal_type` = 'admin'
  AND parent.`name` = 'PolicyManagement'
SET child.`parent_id` = parent.`id`
WHERE child.`portal_type` = 'admin'
  AND child.`name` IN (
    'PolicyFile',
    'PolicyCollectJob',
    'PolicyCollectRun',
    'PolicyCollectNotification',
    'PolicyCollectReview'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.`portal_type`, parent.`id`, 'PolicyCollectNotification', 'collect-notifications', 'policy/collect/notification-center', NULL, 'menu', 'lucide:bell', '通知中心', 6, 1, 'Policy:CollectWorkbench:View', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.`portal_type` = 'admin'
  AND parent.`name` = 'PolicyManagement'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_menu`
    WHERE `portal_type` = 'admin'
      AND `name` = 'PolicyCollectNotification'
  );

UPDATE `sys_menu`
SET `path` = 'collect-jobs',
    `component` = 'policy/collect/job-list',
    `menu_type` = 'menu',
    `icon` = 'lucide:radar',
    `title` = '政策采集任务',
    `order_num` = 4,
    `status` = 1,
    `auth_code` = 'Policy:CollectJob:List'
WHERE `portal_type` = 'admin'
  AND `name` = 'PolicyCollectJob';

UPDATE `sys_menu`
SET `path` = 'collect-runs',
    `component` = 'policy/collect/run-list',
    `menu_type` = 'menu',
    `icon` = 'lucide:history',
    `title` = '同步中心',
    `order_num` = 5,
    `status` = 1,
    `auth_code` = 'Policy:CollectRun:List'
WHERE `portal_type` = 'admin'
  AND `name` = 'PolicyCollectRun';

UPDATE `sys_menu`
SET `path` = 'collect-notifications',
    `component` = 'policy/collect/notification-center',
    `menu_type` = 'menu',
    `icon` = 'lucide:bell',
    `title` = '通知中心',
    `order_num` = 6,
    `status` = 1,
    `auth_code` = 'Policy:CollectWorkbench:View'
WHERE `portal_type` = 'admin'
  AND `name` = 'PolicyCollectNotification';

UPDATE `sys_menu`
SET `path` = 'collect-review',
    `component` = 'policy/collect/review-list',
    `menu_type` = 'menu',
    `icon` = 'lucide:clipboard-check',
    `title` = '政策待审查',
    `order_num` = 7,
    `status` = 1,
    `auth_code` = 'Policy:CollectReview:List'
WHERE `portal_type` = 'admin'
  AND `name` = 'PolicyCollectReview';
