-- 申报配置页面分层：区域基础、统一政策项目、申报规则中心。
-- 可重复执行，不修改业务数据和方案快照。

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.`portal_type`, parent.`id`, 'DeclarationBaseCenter', 'declaration-base', NULL, '/policy/regions', 'catalog', 'lucide:map', '区域基础', 1, 1, NULL, NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.`portal_type` = 'admin'
  AND parent.`name` = 'DeclarationConfiguration'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` item
    WHERE item.`portal_type` = 'admin' AND item.`name` = 'DeclarationBaseCenter'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.`portal_type`, parent.`id`, 'DeclarationRuleCenter', 'declaration-rules', NULL, '/policy/enterprise-presets', 'catalog', 'lucide:sliders-horizontal', '申报规则中心', 3, 1, NULL, NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.`portal_type` = 'admin'
  AND parent.`name` = 'DeclarationConfiguration'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` item
    WHERE item.`portal_type` = 'admin' AND item.`name` = 'DeclarationRuleCenter'
  );

UPDATE `sys_menu` child
JOIN `sys_menu` parent
  ON parent.`portal_type` = 'admin' AND parent.`name` = 'DeclarationBaseCenter'
SET child.`parent_id` = parent.`id`,
    child.`path` = 'regions',
    child.`component` = 'policy/region/list',
    child.`menu_type` = 'menu',
    child.`order_num` = 1
WHERE child.`portal_type` = 'admin'
  AND child.`name` = 'PolicyRegion';

UPDATE `sys_menu` child
JOIN `sys_menu` parent
  ON parent.`portal_type` = 'admin' AND parent.`name` = 'PolicyManagement'
SET child.`parent_id` = parent.`id`,
    child.`path` = 'files',
    child.`component` = 'policy/file/list',
    child.`menu_type` = 'menu',
    child.`icon` = 'lucide:file-text',
    child.`title` = '区域政策文件',
    child.`order_num` = 1,
    child.`status` = 1,
    child.`auth_code` = 'Policy:File:List'
WHERE child.`portal_type` = 'admin'
  AND child.`name` = 'PolicyFile';

UPDATE `sys_menu` child
JOIN `sys_menu` parent
  ON parent.`portal_type` = 'admin' AND parent.`name` = 'PolicyProjectCenter'
SET child.`parent_id` = parent.`id`,
    child.`path` = CASE child.`name` WHEN 'PolicyProject' THEN 'projects' ELSE 'declaration-schemes' END,
    child.`component` = CASE child.`name` WHEN 'PolicyProject' THEN 'policy/project/list' ELSE 'policy/project/declaration-scheme-list' END,
    child.`menu_type` = 'menu',
    child.`order_num` = CASE child.`name` WHEN 'PolicyProject' THEN 1 ELSE 2 END
WHERE child.`portal_type` = 'admin'
  AND child.`name` IN ('PolicyProject', 'PolicyDeclarationScheme');

UPDATE `sys_menu` child
JOIN `sys_menu` parent
  ON parent.`portal_type` = 'admin' AND parent.`name` = 'DeclarationRuleCenter'
SET child.`parent_id` = parent.`id`,
    child.`path` = CASE child.`name`
      WHEN 'PolicyEnterprisePreset' THEN 'enterprise-presets'
      WHEN 'PolicyQualificationPreset' THEN 'qualification-presets'
      WHEN 'PolicyMaterialPreset' THEN 'material-presets'
      WHEN 'PolicyScorePreset' THEN 'score-presets'
      ELSE 'flow-presets'
    END,
    child.`component` = CASE child.`name`
      WHEN 'PolicyEnterprisePreset' THEN 'policy/preset/enterprise-list'
      WHEN 'PolicyQualificationPreset' THEN 'policy/preset/qualification-list'
      WHEN 'PolicyMaterialPreset' THEN 'policy/preset/material-list'
      WHEN 'PolicyScorePreset' THEN 'policy/preset/score-list'
      ELSE 'policy/preset/flow-list'
    END,
    child.`menu_type` = 'menu',
    child.`order_num` = CASE child.`name`
      WHEN 'PolicyEnterprisePreset' THEN 1
      WHEN 'PolicyQualificationPreset' THEN 2
      WHEN 'PolicyMaterialPreset' THEN 3
      WHEN 'PolicyScorePreset' THEN 4
      ELSE 5
    END
WHERE child.`portal_type` = 'admin'
  AND child.`name` IN (
    'PolicyEnterprisePreset',
    'PolicyQualificationPreset',
    'PolicyMaterialPreset',
    'PolicyScorePreset',
    'PolicyFlowPreset'
  );

UPDATE `sys_menu`
SET `redirect_path` = '/policy/regions'
WHERE `portal_type` = 'admin'
  AND `name` = 'DeclarationConfiguration';
