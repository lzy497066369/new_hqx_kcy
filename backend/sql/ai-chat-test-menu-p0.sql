SET @@session.time_zone = '+08:00';

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AI:Module', 'AI 模块', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AI:Module');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AI:ChatTest', 'AI 对话测试', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AI:ChatTest');

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
  'AiModule',
  '/ai',
  NULL,
  '/ai/chat-test',
  'catalog',
  'lucide:bot',
  'AI 模块',
  180,
  1,
  'AI:Module',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_menu` WHERE `name` = 'AiModule'
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
  'AiChatTest',
  '/ai/chat-test',
  'ai/chat-test/index',
  NULL,
  'menu',
  'lucide:message-square-text',
  'AI 对话测试',
  1,
  1,
  'AI:ChatTest',
  NOW(),
  NOW()
FROM `sys_menu` parent
WHERE parent.`name` = 'AiModule'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `name` = 'AiChatTest'
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.`code` IN ('AI:Module', 'AI:ChatTest')
WHERE r.`code` = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.`role_id` = r.`id` AND rp.`permission_id` = p.`id`
  );
