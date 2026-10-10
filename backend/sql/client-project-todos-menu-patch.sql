-- Client declaration todos menu route.
-- Adds the visible client-side route under ClientProjects for backend-driven menus.

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`,
  `title`, `order_num`, `status`, `auth_code`, `portal_type`, `created_at`, `updated_at`
)
SELECT parent.`id`, 'ClientProjectTodos', '/projects/todos', 'client/tasks/index',
       NULL, 'menu', 'mdi:clipboard-alert-outline', '申报待办',
       28, 1, NULL, 'client', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.`portal_type` = 'client'
  AND parent.`name` = 'ClientProjects'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_menu` existed
    WHERE existed.`portal_type` = 'client'
      AND existed.`name` = 'ClientProjectTodos'
  );

UPDATE `sys_menu` child
JOIN `sys_menu` parent
  ON parent.`portal_type` = 'client'
  AND parent.`name` = 'ClientProjects'
SET child.`parent_id` = parent.`id`,
    child.`path` = '/projects/todos',
    child.`component` = 'client/tasks/index',
    child.`redirect_path` = NULL,
    child.`menu_type` = 'menu',
    child.`icon` = 'mdi:clipboard-alert-outline',
    child.`title` = '申报待办',
    child.`order_num` = 28,
    child.`status` = 1,
    child.`auth_code` = NULL,
    child.`portal_type` = 'client'
WHERE child.`portal_type` = 'client'
  AND child.`name` = 'ClientProjectTodos';

UPDATE `sys_menu`
SET `order_num` = 29,
    `updated_at` = NOW()
WHERE `portal_type` = 'client'
  AND `name` = 'ClientProjectDetail';

UPDATE `sys_menu`
SET `order_num` = 30,
    `updated_at` = NOW()
WHERE `portal_type` = 'client'
  AND `name` = 'ClientMyProjectDetail';
