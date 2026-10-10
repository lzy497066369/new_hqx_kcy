-- 统一政策项目下的独立预设，以及地区申报方案引用关系。

CREATE TABLE IF NOT EXISTS `biz_declaration_preset` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `preset_type` VARCHAR(32) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `version` VARCHAR(32) NOT NULL DEFAULT 'v1',
  `status` VARCHAR(16) NOT NULL DEFAULT 'draft',
  `description` VARCHAR(500) DEFAULT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_declaration_preset_type_name_version` (`preset_type`, `name`, `version`),
  KEY `idx_declaration_preset_type_status` (`preset_type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `biz_declaration_scheme`
  ADD COLUMN `enterprise_preset_id` BIGINT DEFAULT NULL,
  ADD COLUMN `enterprise_preset_json` LONGTEXT DEFAULT NULL,
  ADD COLUMN `qualification_preset_id` BIGINT DEFAULT NULL,
  ADD COLUMN `material_preset_id` BIGINT DEFAULT NULL,
  ADD COLUMN `score_preset_id` BIGINT DEFAULT NULL,
  ADD COLUMN `flow_preset_id` BIGINT DEFAULT NULL;

INSERT INTO `sys_permission` (`portal_type`, `code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'admin', 'Policy:DeclarationPreset:List', '申报预设查看', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_permission`
  WHERE `portal_type` = 'admin' AND `code` = 'Policy:DeclarationPreset:List'
);

INSERT INTO `sys_permission` (`portal_type`, `code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'admin', 'Policy:DeclarationPreset:Manage', '申报预设维护', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_permission`
  WHERE `portal_type` = 'admin' AND `code` = 'Policy:DeclarationPreset:Manage'
);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT role_row.`id`, permission_row.`id`, NOW(), NOW()
FROM `sys_role` role_row
JOIN `sys_permission` permission_row
  ON permission_row.`portal_type` = 'admin'
  AND permission_row.`code` IN ('Policy:DeclarationPreset:List', 'Policy:DeclarationPreset:Manage')
WHERE role_row.`portal_type` = 'admin'
  AND role_row.`code` = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_permission` existing
    WHERE existing.`role_id` = role_row.`id`
      AND existing.`permission_id` = permission_row.`id`
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.`portal_type`, parent.`id`, 'PolicyProjectCenter', 'policy-project-center', NULL, '/policy/projects', 'catalog', 'lucide:folder-tree', '统一政策项目', 2, 1, NULL, NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.`portal_type` = 'admin'
  AND parent.`name` = 'DeclarationConfiguration'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu`
    WHERE `portal_type` = 'admin' AND `name` = 'PolicyProjectCenter'
  );

UPDATE `sys_menu` center_menu
JOIN `sys_menu` parent ON parent.`id` = center_menu.`parent_id`
SET center_menu.`path` = 'policy-project-center',
    center_menu.`component` = NULL,
    center_menu.`redirect_path` = '/policy/projects',
    center_menu.`menu_type` = 'catalog',
    center_menu.`icon` = 'lucide:folder-tree',
    center_menu.`title` = '统一政策项目',
    center_menu.`order_num` = 2,
    center_menu.`status` = 1,
    center_menu.`auth_code` = NULL
WHERE center_menu.`portal_type` = 'admin'
  AND center_menu.`name` = 'PolicyProjectCenter'
  AND parent.`name` = 'DeclarationConfiguration';

UPDATE `sys_menu` child
JOIN `sys_menu` parent ON parent.`portal_type` = 'admin' AND parent.`name` = 'PolicyProjectCenter'
SET child.`parent_id` = parent.`id`,
    child.`title` = '项目库',
    child.`order_num` = 1
WHERE child.`portal_type` = 'admin'
  AND child.`name` = 'PolicyProject';

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.`portal_type`, parent.`id`, item.`name`, item.`path`, item.`component`, NULL, 'menu', item.`icon`, item.`title`, item.`order_num`, 1, 'Policy:DeclarationPreset:List', NOW(), NOW()
FROM `sys_menu` parent
JOIN (
  SELECT 'PolicyEnterprisePreset' AS `name`, 'enterprise-presets' AS `path`, 'policy/preset/enterprise-list' AS `component`, 'lucide:building-2' AS `icon`, '企业预设' AS `title`, 2 AS `order_num`
  UNION ALL SELECT 'PolicyQualificationPreset', 'qualification-presets', 'policy/preset/qualification-list', 'lucide:badge-check', '资格条件预设', 3
  UNION ALL SELECT 'PolicyMaterialPreset', 'material-presets', 'policy/preset/material-list', 'lucide:files', '材料清单预设', 4
  UNION ALL SELECT 'PolicyScorePreset', 'score-presets', 'policy/preset/score-list', 'lucide:chart-no-axes-column-increasing', '评分模型预设', 5
  UNION ALL SELECT 'PolicyFlowPreset', 'flow-presets', 'policy/preset/flow-list', 'lucide:git-branch', '流程模板预设', 6
) item
WHERE parent.`portal_type` = 'admin'
  AND parent.`name` = 'PolicyProjectCenter'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` existed
    WHERE existed.`portal_type` = 'admin' AND existed.`name` = item.`name`
  );

UPDATE `sys_menu` child
JOIN `sys_menu` parent ON parent.`portal_type` = 'admin' AND parent.`name` = 'PolicyProjectCenter'
JOIN (
  SELECT 'PolicyEnterprisePreset' AS `name`, 'enterprise-presets' AS `path`, 'policy/preset/enterprise-list' AS `component`, 'lucide:building-2' AS `icon`, '企业预设' AS `title`, 2 AS `order_num`
  UNION ALL SELECT 'PolicyQualificationPreset', 'qualification-presets', 'policy/preset/qualification-list', 'lucide:badge-check', '资格条件预设', 3
  UNION ALL SELECT 'PolicyMaterialPreset', 'material-presets', 'policy/preset/material-list', 'lucide:files', '材料清单预设', 4
  UNION ALL SELECT 'PolicyScorePreset', 'score-presets', 'policy/preset/score-list', 'lucide:chart-no-axes-column-increasing', '评分模型预设', 5
  UNION ALL SELECT 'PolicyFlowPreset', 'flow-presets', 'policy/preset/flow-list', 'lucide:git-branch', '流程模板预设', 6
) item ON item.`name` = child.`name`
SET child.`parent_id` = parent.`id`,
    child.`path` = item.`path`,
    child.`component` = item.`component`,
    child.`redirect_path` = NULL,
    child.`menu_type` = 'menu',
    child.`icon` = item.`icon`,
    child.`title` = item.`title`,
    child.`order_num` = item.`order_num`,
    child.`status` = 1,
    child.`auth_code` = 'Policy:DeclarationPreset:List'
WHERE child.`portal_type` = 'admin';

UPDATE `sys_menu` child
JOIN `sys_menu` parent ON parent.`portal_type` = 'admin' AND parent.`name` = 'PolicyProjectCenter'
SET child.`parent_id` = parent.`id`,
    child.`title` = '地区申报方案',
    child.`order_num` = 7
WHERE child.`portal_type` = 'admin'
  AND child.`name` = 'PolicyDeclarationScheme';

UPDATE `sys_menu`
SET `order_num` = 3
WHERE `portal_type` = 'admin'
  AND `name` = 'PolicyFile';
