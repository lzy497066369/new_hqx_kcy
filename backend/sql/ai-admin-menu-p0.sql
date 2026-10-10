SET @@session.time_zone = '+08:00';

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AI:Record:List', 'AI 请求记录', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AI:Record:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AI:Stats:View', 'AI 统计分析', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AI:Stats:View');

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
  'SystemAiRecord',
  'ai-record',
  'system/ai-record/list',
  NULL,
  'menu',
  'lucide:bot',
  'AI 请求记录',
  6,
  1,
  'AI:Record:List',
  NOW(),
  NOW()
FROM `sys_menu` parent
WHERE parent.`name` = 'System'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `name` = 'SystemAiRecord'
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.`code` = 'AI:Record:List'
WHERE r.`code` = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.`role_id` = r.`id` AND rp.`permission_id` = p.`id`
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.`code` = 'AI:Stats:View'
WHERE r.`code` = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.`role_id` = r.`id` AND rp.`permission_id` = p.`id`
  );
