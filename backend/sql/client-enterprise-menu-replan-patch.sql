-- Replan client enterprise-side menus for the standalone client service.
UPDATE `sys_menu`
SET `status` = 0,
    `portal_type` = 'client'
WHERE `name` = 'Client';

UPDATE `sys_menu`
SET `status` = 0
WHERE `portal_type` = 'client'
  AND `name` IN (
    'ClientEnterprise',
    'ClientDeclare',
    'ClientPolicy',
    'ClientContent',
    'ClientEnterpriseOwner',
    'ClientEnterpriseUser',
    'ClientPolicyQuery'
  );

UPDATE `sys_menu`
SET `status` = 0
WHERE `portal_type` = 'client'
  AND `menu_type` = 'button';

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `portal_type`, `created_at`, `updated_at`
)
SELECT NULL, item.name, item.path, 'client/page-shell/index', NULL, 'menu', item.icon, item.title, item.order_num, 1, NULL, 'client', NOW(), NOW()
FROM `sys_menu` parent
JOIN (
  SELECT 'ClientHome' AS name, '/home' AS path, 'mdi:view-dashboard-outline' AS icon, '工作台' AS title, 1 AS order_num
  UNION ALL SELECT 'ClientDashboard', '/dashboard', 'mdi:chart-box-outline', '数据看板', 2
  UNION ALL SELECT 'ClientTasks', '/tasks', 'mdi:clipboard-check-outline', '待办事项', 3
  UNION ALL SELECT 'ClientCompanyProfile', '/company/profile', 'mdi:domain', '企业基本信息', 11
  UNION ALL SELECT 'ClientCompanyEmployees', '/company/employees', 'mdi:account-group-outline', '员工信息', 12
  UNION ALL SELECT 'ClientCompanyTax', '/company/tax', 'mdi:finance', '财税信息', 13
  UNION ALL SELECT 'ClientCompanyMaterials', '/company/materials', 'mdi:file-upload-outline', '资料上传', 14
  UNION ALL SELECT 'ClientCompanyContacts', '/company/contacts', 'mdi:card-account-phone-outline', '联系人信息', 15
  UNION ALL SELECT 'ClientPolicyMatched', '/policy/matched', 'mdi:target-variant', '匹配政策', 21
  UNION ALL SELECT 'ClientPolicyList', '/policy/list', 'mdi:newspaper-variant-outline', '政策库', 22
  UNION ALL SELECT 'ClientPolicyProjects', '/policy/projects', 'mdi:file-document-edit-outline', '可申报项目', 23
  UNION ALL SELECT 'ClientPolicyFavorites', '/policy/favorites', 'mdi:star-outline', '我的收藏', 24
  UNION ALL SELECT 'ClientPolicyQuestions', '/policy/questions', 'mdi:comment-question-outline', '政策问答', 25
  UNION ALL SELECT 'ClientSettingsCompanySwitch', '/settings/company-switch', 'mdi:swap-horizontal', '切换公司', 31
  UNION ALL SELECT 'ClientSettingsUsers', '/settings/users', 'mdi:account-cog-outline', '企业用户', 32
  UNION ALL SELECT 'ClientSettingsAccount', '/settings/account', 'mdi:account-circle-outline', '我的账号', 33
) item
WHERE parent.name = 'Client'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` existed WHERE existed.`name` = item.name
  );

UPDATE `sys_menu`
JOIN (
  SELECT 'ClientHome' AS name, '/home' AS path, 'mdi:view-dashboard-outline' AS icon, '工作台' AS title, 1 AS order_num
  UNION ALL SELECT 'ClientDashboard', '/dashboard', 'mdi:chart-box-outline', '数据看板', 2
  UNION ALL SELECT 'ClientTasks', '/tasks', 'mdi:clipboard-check-outline', '待办事项', 3
  UNION ALL SELECT 'ClientCompanyProfile', '/company/profile', 'mdi:domain', '企业基本信息', 11
  UNION ALL SELECT 'ClientCompanyEmployees', '/company/employees', 'mdi:account-group-outline', '员工信息', 12
  UNION ALL SELECT 'ClientCompanyTax', '/company/tax', 'mdi:finance', '财税信息', 13
  UNION ALL SELECT 'ClientCompanyMaterials', '/company/materials', 'mdi:file-upload-outline', '资料上传', 14
  UNION ALL SELECT 'ClientCompanyContacts', '/company/contacts', 'mdi:card-account-phone-outline', '联系人信息', 15
  UNION ALL SELECT 'ClientPolicyMatched', '/policy/matched', 'mdi:target-variant', '匹配政策', 21
  UNION ALL SELECT 'ClientPolicyList', '/policy/list', 'mdi:newspaper-variant-outline', '政策库', 22
  UNION ALL SELECT 'ClientPolicyProjects', '/policy/projects', 'mdi:file-document-edit-outline', '可申报项目', 23
  UNION ALL SELECT 'ClientPolicyFavorites', '/policy/favorites', 'mdi:star-outline', '我的收藏', 24
  UNION ALL SELECT 'ClientPolicyQuestions', '/policy/questions', 'mdi:comment-question-outline', '政策问答', 25
  UNION ALL SELECT 'ClientSettingsCompanySwitch', '/settings/company-switch', 'mdi:swap-horizontal', '切换公司', 31
  UNION ALL SELECT 'ClientSettingsUsers', '/settings/users', 'mdi:account-cog-outline', '企业用户', 32
  UNION ALL SELECT 'ClientSettingsAccount', '/settings/account', 'mdi:account-circle-outline', '我的账号', 33
) item ON item.name = `sys_menu`.`name`
SET `sys_menu`.`path` = item.path,
    `sys_menu`.`parent_id` = NULL,
    `sys_menu`.`component` = 'client/page-shell/index',
    `sys_menu`.`icon` = item.icon,
    `sys_menu`.`title` = item.title,
    `sys_menu`.`order_num` = item.order_num,
    `sys_menu`.`status` = 1,
    `sys_menu`.`auth_code` = NULL,
    `sys_menu`.`portal_type` = 'client';

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `portal_type`, `created_at`, `updated_at`
)
SELECT NULL, item.name, item.path, NULL, item.redirect_path, 'catalog', item.icon, item.title, item.order_num, 1, NULL, 'client', NOW(), NOW()
FROM (
  SELECT 'ClientWorkspace' AS name, '/workspace' AS path, '/home' AS redirect_path, 'mdi:view-dashboard-outline' AS icon, '工作台' AS title, 1 AS order_num
  UNION ALL SELECT 'ClientCompany', '/company', '/company/profile', 'mdi:domain', '企业资料', 10
  UNION ALL SELECT 'ClientPolicyCenter', '/policy', '/policy/library', 'mdi:newspaper-variant-outline', '政策中心', 20
  UNION ALL SELECT 'ClientSettings', '/settings', '/settings/company-switch', 'mdi:cog-outline', '企业设置', 30
) item
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_menu` existed WHERE existed.`name` = item.name
);

UPDATE `sys_menu`
JOIN (
  SELECT 'ClientWorkspace' AS name, '/workspace' AS path, '/home' AS redirect_path, 'mdi:view-dashboard-outline' AS icon, '工作台' AS title, 1 AS order_num
  UNION ALL SELECT 'ClientCompany', '/company', '/company/profile', 'mdi:domain', '企业资料', 10
  UNION ALL SELECT 'ClientPolicyCenter', '/policy', '/policy/library', 'mdi:newspaper-variant-outline', '政策中心', 20
  UNION ALL SELECT 'ClientSettings', '/settings', '/settings/company-switch', 'mdi:cog-outline', '企业设置', 30
) item ON item.name = `sys_menu`.`name`
SET `sys_menu`.`parent_id` = NULL,
    `sys_menu`.`path` = item.path,
    `sys_menu`.`component` = NULL,
    `sys_menu`.`redirect_path` = item.redirect_path,
    `sys_menu`.`menu_type` = 'catalog',
    `sys_menu`.`icon` = item.icon,
    `sys_menu`.`title` = item.title,
    `sys_menu`.`order_num` = item.order_num,
    `sys_menu`.`status` = 1,
    `sys_menu`.`auth_code` = NULL,
    `sys_menu`.`portal_type` = 'client';

UPDATE `sys_menu` child
JOIN `sys_menu` parent ON parent.`name` = CASE
    WHEN child.`name` IN ('ClientHome', 'ClientDashboard', 'ClientTasks')
      THEN 'ClientWorkspace'
    WHEN child.`name` IN (
      'ClientCompanyProfile',
      'ClientCompanyEmployees',
      'ClientCompanyTax',
      'ClientCompanyMaterials',
      'ClientCompanyContacts'
    )
      THEN 'ClientCompany'
    WHEN child.`name` IN (
      'ClientPolicyList',
      'ClientPolicyLibrary'
    )
      THEN 'ClientPolicyCenter'
    WHEN child.`name` IN ('ClientProjectList', 'ClientMyProjectList')
      THEN 'ClientProjects'
    WHEN child.`name` IN (
      'ClientSettingsCompanySwitch',
      'ClientSettingsUsers',
      'ClientSettingsAccount'
    )
      THEN 'ClientSettings'
    ELSE ''
  END
SET child.`parent_id` = parent.`id`
WHERE child.`portal_type` = 'client'
  AND child.`name` IN (
    'ClientHome',
    'ClientDashboard',
    'ClientTasks',
    'ClientCompanyProfile',
    'ClientCompanyEmployees',
    'ClientCompanyTax',
    'ClientCompanyMaterials',
    'ClientCompanyContacts',
    'ClientPolicyMatched',
    'ClientPolicyList',
    'ClientPolicyProjects',
    'ClientPolicyFavorites',
    'ClientPolicyQuestions',
    'ClientPolicyLibrary',
    'ClientProjectList',
    'ClientMyProjectList',
    'ClientSettingsCompanySwitch',
    'ClientSettingsUsers',
    'ClientSettingsAccount'
  );

UPDATE `sys_menu`
SET `status` = 0
WHERE `portal_type` = 'client'
  AND `name` IN (
    'ClientPolicyMatched',
    'ClientPolicyList',
    'ClientPolicyProjects',
    'ClientPolicyFavorites',
    'ClientPolicyQuestions'
  );

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `portal_type`, `created_at`, `updated_at`
)
SELECT NULL, 'ClientProjects', '/projects', NULL, '/projects/list', 'catalog', 'mdi:file-document-edit-outline', '申报项目', 25, 1, NULL, 'client', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_menu` existed WHERE existed.`name` = 'ClientProjects'
);

UPDATE `sys_menu`
SET `parent_id` = NULL,
    `path` = '/projects',
    `component` = NULL,
    `redirect_path` = '/projects/list',
    `menu_type` = 'catalog',
    `icon` = 'mdi:file-document-edit-outline',
    `title` = '申报项目',
    `order_num` = 25,
    `status` = 1,
    `auth_code` = NULL,
    `portal_type` = 'client'
WHERE `name` = 'ClientProjects';

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `portal_type`, `created_at`, `updated_at`
)
SELECT parent.id, item.name, item.path, item.component, NULL, 'menu', item.icon, item.title, item.order_num, 1, NULL, 'client', NOW(), NOW()
FROM `sys_menu` parent
JOIN (
  SELECT 'ClientPolicyLibrary' AS name, '/policy/library' AS path, 'client/policy-library/index' AS component, 'mdi:newspaper-variant-outline' AS icon, '政策库' AS title, 21 AS order_num, 'ClientPolicyCenter' AS parent_name
  UNION ALL SELECT 'ClientProjectList', '/projects/list', 'client/projects/list', 'mdi:format-list-bulleted-square', '项目列表', 26, 'ClientProjects'
  UNION ALL SELECT 'ClientMyProjectList', '/projects/my', 'client/projects/my', 'mdi:folder-account-outline', '我的项目列表', 27, 'ClientProjects'
  UNION ALL SELECT 'ClientProjectDetail', '/projects/detail/:id', 'client/projects/detail', NULL, '项目详情', 28, 'ClientProjects'
  UNION ALL SELECT 'ClientMyProjectDetail', '/projects/my/detail/:id', 'client/projects/my-detail', NULL, '申报详情', 29, 'ClientProjects'
) item ON item.parent_name = parent.name
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_menu` existed WHERE existed.`name` = item.name
);

UPDATE `sys_menu` child
JOIN (
  SELECT 'ClientPolicyLibrary' AS name, 'ClientPolicyCenter' AS parent_name, '/policy/library' AS path, 'client/policy-library/index' AS component, 'mdi:newspaper-variant-outline' AS icon, '政策库' AS title, 21 AS order_num
  UNION ALL SELECT 'ClientProjectList', 'ClientProjects', '/projects/list', 'client/projects/list', 'mdi:format-list-bulleted-square', '项目列表', 26
  UNION ALL SELECT 'ClientMyProjectList', 'ClientProjects', '/projects/my', 'client/projects/my', 'mdi:folder-account-outline', '我的项目列表', 27
  UNION ALL SELECT 'ClientProjectDetail', 'ClientProjects', '/projects/detail/:id', 'client/projects/detail', NULL, '项目详情', 28
  UNION ALL SELECT 'ClientMyProjectDetail', 'ClientProjects', '/projects/my/detail/:id', 'client/projects/my-detail', NULL, '申报详情', 29
) item ON item.name = child.name
JOIN `sys_menu` parent ON parent.name = item.parent_name
SET child.`parent_id` = parent.`id`,
    child.`path` = item.path,
    child.`component` = item.component,
    child.`redirect_path` = NULL,
    child.`menu_type` = 'menu',
    child.`icon` = item.icon,
    child.`title` = item.title,
    child.`order_num` = item.order_num,
    child.`status` = 1,
    child.`auth_code` = NULL,
    child.`portal_type` = 'client';

UPDATE `sys_menu`
JOIN (
  SELECT 'ClientHome' AS name, 'dashboard/workspace/index' AS component
  UNION ALL SELECT 'ClientDashboard', 'dashboard/analytics/index'
  UNION ALL SELECT 'ClientTasks', 'client/tasks/index'
  UNION ALL SELECT 'ClientSettingsCompanySwitch', 'client/company-switch/index'
  UNION ALL SELECT 'ClientSettingsUsers', 'client/enterprise-user/index'
  UNION ALL SELECT 'ClientSettingsAccount', 'client/profile/index'
) item ON item.name = `sys_menu`.`name`
SET `sys_menu`.`component` = item.component
WHERE `sys_menu`.`portal_type` = 'client';

-- Point client enterprise-profile menus to the real web-client page files.
INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `portal_type`, `created_at`, `updated_at`
)
SELECT parent.id, item.name, item.path, item.component, NULL, 'menu', item.icon, item.title, item.order_num, 1, NULL, 'client', NOW(), NOW()
FROM `sys_menu` parent
JOIN (
  SELECT 'ClientCompanyProfile' AS name, '/company/profile' AS path, 'client/enterprise-profile/company' AS component, 'mdi:domain' AS icon, '企业资料总览' AS title, 10 AS order_num
  UNION ALL SELECT 'ClientCompanyBasic', '/company/profile/basic', 'client/enterprise-profile/company-basic', 'mdi:card-account-details-outline', '基本信息', 11
  UNION ALL SELECT 'ClientCompanyContacts', '/company/contacts', 'client/enterprise-profile/company-contacts', 'mdi:card-account-phone-outline', '联系人信息', 12
  UNION ALL SELECT 'ClientCompanyTax', '/company/tax', 'client/enterprise-profile/finance/index', 'mdi:finance', '财税信息', 13
  UNION ALL SELECT 'ClientCompanyEmployees', '/company/employees', 'client/enterprise-profile/employee/index', 'mdi:account-group-outline', '员工信息', 14
  UNION ALL SELECT 'ClientCompanyProperty', '/company/property', 'client/enterprise-profile/property/index', 'mdi:certificate-outline', '知识产权', 15
  UNION ALL SELECT 'ClientCompanyContract', '/company/contracts', 'client/enterprise-profile/contract/index', 'mdi:file-sign', '合同和发票', 16
  UNION ALL SELECT 'ClientCompanyDocument', '/company/documents', 'client/enterprise-profile/document/index', 'mdi:file-document-multiple-outline', '制度文件', 17
  UNION ALL SELECT 'ClientCompanyCertificates', '/company/certificates', 'client/enterprise-profile/company-materials', 'mdi:award-outline', '企业证书', 18
  UNION ALL SELECT 'ClientCompanyPhotos', '/company/photos', 'client/enterprise-profile/company-materials', 'mdi:image-multiple-outline', '照片', 19
  UNION ALL SELECT 'ClientCompanyAccount', '/company/account', 'client/enterprise-profile/company-account', 'mdi:key-variant', '企业账号', 20
) item ON parent.name = 'ClientCompany'
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_menu` existed WHERE existed.`name` = item.name
);

UPDATE `sys_menu` child
JOIN (
  SELECT 'ClientCompanyProfile' AS name, '/company/profile' AS path, 'client/enterprise-profile/company' AS component, 'mdi:domain' AS icon, '企业资料总览' AS title, 10 AS order_num
  UNION ALL SELECT 'ClientCompanyBasic', '/company/profile/basic', 'client/enterprise-profile/company-basic', 'mdi:card-account-details-outline', '基本信息', 11
  UNION ALL SELECT 'ClientCompanyContacts', '/company/contacts', 'client/enterprise-profile/company-contacts', 'mdi:card-account-phone-outline', '联系人信息', 12
  UNION ALL SELECT 'ClientCompanyTax', '/company/tax', 'client/enterprise-profile/finance/index', 'mdi:finance', '财税信息', 13
  UNION ALL SELECT 'ClientCompanyEmployees', '/company/employees', 'client/enterprise-profile/employee/index', 'mdi:account-group-outline', '员工信息', 14
  UNION ALL SELECT 'ClientCompanyProperty', '/company/property', 'client/enterprise-profile/property/index', 'mdi:certificate-outline', '知识产权', 15
  UNION ALL SELECT 'ClientCompanyContract', '/company/contracts', 'client/enterprise-profile/contract/index', 'mdi:file-sign', '合同和发票', 16
  UNION ALL SELECT 'ClientCompanyDocument', '/company/documents', 'client/enterprise-profile/document/index', 'mdi:file-document-multiple-outline', '制度文件', 17
  UNION ALL SELECT 'ClientCompanyCertificates', '/company/certificates', 'client/enterprise-profile/company-materials', 'mdi:award-outline', '企业证书', 18
  UNION ALL SELECT 'ClientCompanyPhotos', '/company/photos', 'client/enterprise-profile/company-materials', 'mdi:image-multiple-outline', '照片', 19
  UNION ALL SELECT 'ClientCompanyMaterials', '/company/materials', 'client/enterprise-profile/company-materials', 'mdi:file-upload-outline', '证书照片', 19
  UNION ALL SELECT 'ClientCompanyAccount', '/company/account', 'client/enterprise-profile/company-account', 'mdi:key-variant', '企业账号', 20
) item ON item.name = child.name
JOIN `sys_menu` parent ON parent.name = 'ClientCompany'
SET child.`parent_id` = parent.`id`,
    child.`path` = item.path,
    child.`component` = item.component,
    child.`redirect_path` = NULL,
    child.`menu_type` = 'menu',
    child.`icon` = item.icon,
    child.`title` = item.title,
    child.`order_num` = item.order_num,
    child.`status` = 1,
    child.`auth_code` = NULL,
    child.`portal_type` = 'client'
WHERE child.`name` IN (
  'ClientCompanyProfile',
  'ClientCompanyBasic',
  'ClientCompanyContacts',
  'ClientCompanyTax',
  'ClientCompanyEmployees',
  'ClientCompanyProperty',
  'ClientCompanyContract',
  'ClientCompanyDocument',
  'ClientCompanyCertificates',
  'ClientCompanyPhotos',
  'ClientCompanyMaterials',
  'ClientCompanyAccount'
);

UPDATE `sys_menu`
SET `path` = '/company/profile',
    `component` = 'client/enterprise-profile/company',
    `redirect_path` = NULL,
    `portal_type` = 'client'
WHERE `name` = 'ClientEnterprise';

-- Keep the legacy materials route corrected for compatibility, but hide it from the new client menu.
UPDATE `sys_menu`
SET `status` = 0,
    `path` = '/company/materials',
    `component` = 'client/enterprise-profile/company-materials',
    `redirect_path` = NULL,
    `portal_type` = 'client'
WHERE `name` = 'ClientCompanyMaterials';
