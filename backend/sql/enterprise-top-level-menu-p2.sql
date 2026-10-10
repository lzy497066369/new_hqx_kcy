-- P2：将企业相关后台功能拆为三个并列一级目录。可重复执行。

UPDATE `sys_menu`
SET `name` = 'EnterpriseServiceStatistics',
    `path` = '/enterprise-service-statistics',
    `redirect_path` = '/enterprise-service-statistics/enterprises',
    `icon` = 'mdi:chart-box-outline',
    `title` = '企业服务中心统计',
    `updated_at` = NOW()
WHERE `portal_type` = 'admin'
  AND `name` IN ('EnterpriseServiceCenter', 'EnterpriseServiceStatistics');

UPDATE `sys_menu`
SET `name` = 'EnterpriseProfileList',
    `path` = 'enterprises',
    `title` = '企业列表',
    `order_num` = 1,
    `updated_at` = NOW()
WHERE `portal_type` = 'admin'
  AND `name` IN ('EnterpriseProfile', 'enterprise-profile', 'EnterpriseProfileList');

UPDATE `sys_menu`
SET `title` = '企业服务中心统计', `updated_at` = NOW()
WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseServiceStatistics';

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT 'admin', NULL, 'EnterpriseMaterialLedger', '/enterprise-material-ledger',
  'enterprise/workspace/materials/index', NULL, 'menu', 'mdi:folder-multiple-outline',
  '企业材料台账', 151, 1, 'Enterprise:Profile:List', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_menu` WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseMaterialLedger'
);

UPDATE `sys_menu`
SET `parent_id` = NULL,
    `path` = '/enterprise-material-ledger',
    `component` = NULL,
    `redirect_path` = '/enterprise-material-ledger/company',
    `menu_type` = 'catalog',
    `icon` = 'mdi:folder-multiple-outline',
    `title` = '企业材料台账',
    `order_num` = 151,
    `updated_at` = NOW()
WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseMaterialLedger';

-- 企业材料台账的资料域与客户端企业资料栏目保持一致，由同一多公司页面承载。
INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT 'admin', parent.id, item.name, item.path, 'enterprise/workspace/materials/index', NULL,
  'menu', item.icon, item.title, item.order_num, 1, 'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
JOIN (
  SELECT 'EnterpriseMaterialOverview' AS name, 'company' AS path, 'lucide:building-2' AS icon, '公司资料' AS title, 1 AS order_num
  UNION ALL SELECT 'EnterpriseMaterialBasic', 'basic', 'lucide:clipboard-pen-line', '企业基础档案', 2
  UNION ALL SELECT 'EnterpriseMaterialFinance', 'finance', 'lucide:landmark', '财税', 3
  UNION ALL SELECT 'EnterpriseMaterialEmployees', 'employee', 'lucide:users-round', '员工', 4
  UNION ALL SELECT 'EnterpriseMaterialProperties', 'intellectual_property', 'lucide:badge-check', '研发与知识产权', 5
  UNION ALL SELECT 'EnterpriseMaterialContracts', 'contract', 'lucide:file-text', '合同和发票', 6
  UNION ALL SELECT 'EnterpriseMaterialDocuments', 'document', 'lucide:book-open-check', '制度文件', 7
  UNION ALL SELECT 'EnterpriseMaterialCertificates', 'certificate', 'lucide:award', '企业证书', 8
  UNION ALL SELECT 'EnterpriseMaterialPhotos', 'photo', 'lucide:image', '照片', 9
  UNION ALL SELECT 'EnterpriseMaterialAccounts', 'account', 'lucide:key-round', '企业账号', 10
) item
WHERE parent.portal_type = 'admin' AND parent.name = 'EnterpriseMaterialLedger'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` existing
    WHERE existing.portal_type = 'admin' AND existing.name = item.name
  );

UPDATE `sys_menu` child
JOIN `sys_menu` parent
  ON parent.`portal_type` = 'admin' AND parent.`name` = 'EnterpriseMaterialLedger'
SET child.`parent_id` = parent.`id`,
    child.`component` = 'enterprise/workspace/materials/index',
    child.`updated_at` = NOW()
WHERE child.`portal_type` = 'admin'
  AND child.`name` IN (
    'EnterpriseMaterialOverview', 'EnterpriseMaterialBasic',
    'EnterpriseMaterialFinance', 'EnterpriseMaterialEmployees',
    'EnterpriseMaterialProperties', 'EnterpriseMaterialContracts', 'EnterpriseMaterialDocuments',
    'EnterpriseMaterialCertificates', 'EnterpriseMaterialPhotos', 'EnterpriseMaterialAccounts'
  );

UPDATE `sys_menu`
SET `path` = 'company', `title` = '公司资料', `updated_at` = NOW()
WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseMaterialOverview';

UPDATE `sys_menu`
SET `path` = 'basic', `title` = '企业基础档案', `updated_at` = NOW()
WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseMaterialBasic';

UPDATE `sys_menu`
SET `title` = '财税', `updated_at` = NOW()
WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseMaterialFinance';

UPDATE `sys_menu`
SET `title` = '员工', `updated_at` = NOW()
WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseMaterialEmployees';

UPDATE `sys_menu`
SET `title` = '研发与知识产权', `updated_at` = NOW()
WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseMaterialProperties';

DELETE FROM `sys_menu`
WHERE `portal_type` = 'admin'
  AND `name` IN (
    'EnterpriseMaterialResearch', 'EnterpriseMaterialProductServices', 'EnterpriseMaterialTransformations',
    'EnterpriseMaterialContacts', 'EnterpriseMaterialTemplates'
  );

UPDATE `sys_menu`
SET `title` = '企业材料台账', `updated_at` = NOW()
WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseMaterialLedger';

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT 'admin', NULL, 'EnterpriseDeclarationManagement', '/enterprise-declaration-management',
  NULL, '/enterprise-declaration-management/declarations', 'catalog', 'mdi:file-document-edit-outline',
  '企业申报管理', 152, 1, 'Enterprise:Profile:List', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_menu` WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseDeclarationManagement'
);

UPDATE `sys_menu`
SET `title` = '企业申报管理',
    `path` = '/enterprise-declaration-management',
    `redirect_path` = '/enterprise-declaration-management/declarations',
    `updated_at` = NOW()
WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseDeclarationManagement';

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT 'admin', parent.id, 'EnterpriseDeclarationList', 'declarations',
  'enterprise/declarations/list', NULL, 'menu', 'mdi:format-list-bulleted',
  '申报列表', 1, 1, 'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.portal_type = 'admin' AND parent.name = 'EnterpriseDeclarationManagement'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseDeclarationList'
  );

UPDATE `sys_menu` child
JOIN `sys_menu` parent
  ON parent.`portal_type` = 'admin' AND parent.`name` = 'EnterpriseDeclarationManagement'
SET child.`parent_id` = parent.`id`, child.`updated_at` = NOW()
WHERE child.`portal_type` = 'admin' AND child.`name` = 'EnterpriseDeclarationList';

UPDATE `sys_menu`
SET `title` = '申报列表', `updated_at` = NOW()
WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseDeclarationList';

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT 'admin', parent.id, 'EnterpriseDeclarationDetail', 'declarations/:enterpriseId/:declarationId',
  'enterprise/declarations/detail', NULL, 'menu', NULL,
  '申报详情', 10, 1, 'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.portal_type = 'admin' AND parent.name = 'EnterpriseDeclarationManagement'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseDeclarationDetail'
  );

UPDATE `sys_menu`
SET `title` = '申报详情', `updated_at` = NOW()
WHERE `portal_type` = 'admin' AND `name` = 'EnterpriseDeclarationDetail';

UPDATE `sys_menu` child
JOIN `sys_menu` parent
  ON parent.`portal_type` = 'admin' AND parent.`name` = 'EnterpriseServiceStatistics'
SET child.`parent_id` = parent.`id`, child.`updated_at` = NOW()
WHERE child.`portal_type` = 'admin' AND child.`name` = 'EnterpriseProfileList';

UPDATE `sys_menu` child
JOIN `sys_menu` parent
  ON parent.`portal_type` = 'admin' AND parent.`name` = 'EnterpriseMaterialLedger'
SET child.`parent_id` = parent.`id`, child.`updated_at` = NOW()
WHERE child.`portal_type` = 'admin'
  AND child.`name` IN (
    'EnterpriseWorkspace', 'EnterpriseWorkspaceProfile', 'EnterpriseWorkspaceFinance',
    'EnterpriseWorkspaceEmployees', 'EnterpriseWorkspaceProperties', 'EnterpriseWorkspaceResearch',
    'EnterpriseWorkspaceProductServices', 'EnterpriseWorkspaceTransformations',
    'EnterpriseWorkspaceEvidenceChain', 'EnterpriseWorkspaceArchiveRecords', 'EnterpriseWorkspaceTodos'
  );

UPDATE `sys_menu` child
JOIN `sys_menu` parent
  ON parent.`portal_type` = 'admin' AND parent.`name` = 'EnterpriseDeclarationManagement'
SET child.`parent_id` = parent.`id`, child.`updated_at` = NOW()
WHERE child.`portal_type` = 'admin' AND child.`name` = 'EnterpriseWorkspaceDeclarations';
