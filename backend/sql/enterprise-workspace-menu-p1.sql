-- 企业服务中心后台菜单。企业服务中心为一级目录；企业列表和材料台账为可见入口。
-- 显式 enterpriseId 的工作台与资料域仅用于受控详情路由，菜单服务会将其隐藏。

UPDATE `sys_menu`
SET `path` = '/enterprise-service-center',
    `redirect_path` = '/enterprise-service-center/materials',
    `icon` = 'mdi:domain',
    `title` = '企业服务中心',
    `updated_at` = NOW()
WHERE `portal_type` = 'admin' AND `path` = '/enterprise';

UPDATE `sys_menu`
SET `path` = 'enterprises',
    `title` = '企业列表',
    `updated_at` = NOW()
WHERE `portal_type` = 'admin'
  AND `parent_id` IN (
    SELECT `id` FROM (
      SELECT `id` FROM `sys_menu`
      WHERE `portal_type` = 'admin' AND `path` = '/enterprise-service-center'
    ) AS enterprise_center
  )
  AND (`name` IN ('EnterpriseProfile', 'enterprise-profile') OR `component` = 'enterprise/profile/list');

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`,
  `created_at`, `updated_at`
)
SELECT 'admin', parent.id, 'EnterpriseMaterialLedger', 'materials',
  'enterprise/workspace/materials/index', NULL, 'menu', 'mdi:folder-multiple-outline',
  '企业材料台账', 2, 1, 'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.portal_type = 'admin'
  AND parent.path = '/enterprise-service-center'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu`
    WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseMaterialLedger'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`,
  `created_at`, `updated_at`
)
SELECT 'admin', parent.id, 'EnterpriseWorkspace', ':enterpriseId/workspace',
  'enterprise/workspace/index', NULL, 'menu', NULL, '企业服务中心', 10, 1,
  'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.portal_type = 'admin'
  AND parent.path = '/enterprise-service-center'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu`
    WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseWorkspace'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`,
  `created_at`, `updated_at`
)
SELECT 'admin', parent.id, 'EnterpriseWorkspaceProfile', ':enterpriseId/profile',
  'enterprise/workspace/profile/index', NULL, 'menu', NULL, '企业档案', 11, 1,
  'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.portal_type = 'admin'
  AND parent.path = '/enterprise-service-center'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu`
    WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseWorkspaceProfile'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`,
  `created_at`, `updated_at`
)
SELECT 'admin', parent.id, 'EnterpriseWorkspaceFinance', ':enterpriseId/finance',
  'enterprise/workspace/finance/index', NULL, 'menu', NULL, '财税资料', 12, 1,
  'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.portal_type = 'admin'
  AND parent.path = '/enterprise-service-center'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu`
    WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseWorkspaceFinance'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`,
  `created_at`, `updated_at`
)
SELECT 'admin', parent.id, 'EnterpriseWorkspaceEmployees', ':enterpriseId/employees',
  'enterprise/workspace/employees/index', NULL, 'menu', NULL, '人员资料', 13, 1,
  'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.portal_type = 'admin'
  AND parent.path = '/enterprise-service-center'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu`
    WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseWorkspaceEmployees'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`,
  `created_at`, `updated_at`
)
SELECT 'admin', parent.id, 'EnterpriseWorkspaceProperties', ':enterpriseId/properties',
  'enterprise/workspace/properties/index', NULL, 'menu', NULL, '知识产权', 14, 1,
  'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.portal_type = 'admin'
  AND parent.path = '/enterprise-service-center'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu`
    WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseWorkspaceProperties'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`,
  `created_at`, `updated_at`
)
SELECT 'admin', parent.id, 'EnterpriseWorkspaceResearch', ':enterpriseId/research',
  'enterprise/workspace/research/index', NULL, 'menu', NULL, '研发项目', 15, 1,
  'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.portal_type = 'admin'
  AND parent.path = '/enterprise-service-center'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu`
    WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseWorkspaceResearch'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`,
  `created_at`, `updated_at`
)
SELECT 'admin', parent.id, 'EnterpriseWorkspaceProductServices', ':enterpriseId/product-services',
  'enterprise/workspace/product-services/index', NULL, 'menu', NULL, '产品服务', 16, 1,
  'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.portal_type = 'admin'
  AND parent.path = '/enterprise-service-center'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu`
    WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseWorkspaceProductServices'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`,
  `created_at`, `updated_at`
)
SELECT 'admin', parent.id, 'EnterpriseWorkspaceTransformations', ':enterpriseId/transformations',
  'enterprise/workspace/transformations/index', NULL, 'menu', NULL, '成果转化', 17, 1,
  'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.portal_type = 'admin'
  AND parent.path = '/enterprise-service-center'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu`
    WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseWorkspaceTransformations'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`,
  `created_at`, `updated_at`
)
SELECT 'admin', parent.id, 'EnterpriseWorkspaceEvidenceChain', ':enterpriseId/evidence-chain',
  'enterprise/workspace/evidence-chain/index', NULL, 'menu', NULL, '证据链总览', 18, 1,
  'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.portal_type = 'admin'
  AND parent.path = '/enterprise-service-center'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu`
    WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseWorkspaceEvidenceChain'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`,
  `created_at`, `updated_at`
)
SELECT 'admin', parent.id, 'EnterpriseWorkspaceArchiveRecords', ':enterpriseId/archive-records',
  'enterprise/workspace/archive-records/index', NULL, 'menu', NULL, '企业档案资料', 19, 1,
  'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.portal_type = 'admin'
  AND parent.path = '/enterprise-service-center'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu`
    WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseWorkspaceArchiveRecords'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`,
  `created_at`, `updated_at`
)
SELECT 'admin', parent.id, 'EnterpriseWorkspaceDeclarations', ':enterpriseId/declarations',
  'enterprise/workspace/declarations/index', NULL, 'menu', NULL, '企业申报工作台', 20, 1,
  'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.portal_type = 'admin'
  AND parent.path = '/enterprise-service-center'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu`
    WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseWorkspaceDeclarations'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`,
  `created_at`, `updated_at`
)
SELECT 'admin', parent.id, 'EnterpriseWorkspaceTodos', ':enterpriseId/todos',
  'enterprise/workspace/todos/index', NULL, 'menu', NULL, '审核与协同待办', 21, 1,
  'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.portal_type = 'admin'
  AND parent.path = '/enterprise-service-center'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu`
    WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseWorkspaceTodos'
  );
