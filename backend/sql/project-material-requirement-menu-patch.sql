-- Project material requirement button permission/menu seed.
-- Compatible with MySQL 5.7 and safe to run repeatedly.

INSERT INTO `sys_permission` (`portal_type`, `code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'admin', 'Policy:Project:MaterialRequirement', '配置项目材料要求', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM `sys_permission`
  WHERE `portal_type` = 'admin'
    AND `code` = 'Policy:Project:MaterialRequirement'
);

INSERT INTO `sys_menu` (
  `portal_type`,
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
  'admin',
  parent.`id`,
  'PolicyProjectMaterialRequirement',
  'material-requirement',
  NULL,
  NULL,
  'button',
  NULL,
  '材料要求',
  4,
  1,
  'Policy:Project:MaterialRequirement',
  NOW(),
  NOW()
FROM `sys_menu` parent
WHERE parent.`portal_type` = 'admin'
  AND parent.`name` = 'PolicyProject'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_menu` existed
    WHERE existed.`portal_type` = 'admin'
      AND existed.`name` = 'PolicyProjectMaterialRequirement'
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.`code` = 'admin'
  AND p.`portal_type` = 'admin'
  AND p.`code` = 'Policy:Project:MaterialRequirement'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.`role_id` = r.`id`
      AND rp.`permission_id` = p.`id`
  );
