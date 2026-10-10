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
  parent.`id`,
  'AiAnalysis',
  '/Dashboard/AiAnalysis',
  'dashboard/ai-analysis/index',
  NULL,
  'menu',
  'lucide:bot',
  'page.dashboard.aiAnalysis',
  3,
  1,
  'AI:Stats:View',
  NOW(),
  NOW()
FROM `sys_menu` parent
WHERE parent.`name` = 'Dashboard'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `name` = 'AiAnalysis'
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
