-- Client project/declaration detail routes.
-- These rows are real routes for backend-driven access mode. The backend marks
-- detail routes as hideInMenu, so they are reachable but not shown in sidebar.

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `portal_type`, `created_at`, `updated_at`
)
SELECT parent.`id`, item.`name`, item.`path`, item.`component`, NULL, 'menu', NULL, item.`title`, item.`order_num`, 1, NULL, 'client', NOW(), NOW()
FROM `sys_menu` parent
JOIN (
  SELECT 'ClientProjectDetail' AS `name`, '/projects/detail/:id' AS `path`, 'client/projects/detail' AS `component`, '项目详情' AS `title`, 28 AS `order_num`
  UNION ALL SELECT 'ClientMyProjectDetail', '/projects/my/detail/:id', 'client/projects/my-detail', '申报详情', 29
) item
WHERE parent.`portal_type` = 'client'
  AND parent.`name` = 'ClientProjects'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_menu` existed
    WHERE existed.`portal_type` = 'client'
      AND existed.`name` = item.`name`
  );

UPDATE `sys_menu` child
JOIN (
  SELECT 'ClientProjectDetail' AS `name`, '/projects/detail/:id' AS `path`, 'client/projects/detail' AS `component`, '项目详情' AS `title`, 28 AS `order_num`
  UNION ALL SELECT 'ClientMyProjectDetail', '/projects/my/detail/:id', 'client/projects/my-detail', '申报详情', 29
) item ON item.`name` = child.`name`
JOIN `sys_menu` parent
  ON parent.`portal_type` = 'client'
  AND parent.`name` = 'ClientProjects'
SET child.`parent_id` = parent.`id`,
    child.`path` = item.`path`,
    child.`component` = item.`component`,
    child.`redirect_path` = NULL,
    child.`menu_type` = 'menu',
    child.`icon` = NULL,
    child.`title` = item.`title`,
    child.`order_num` = item.`order_num`,
    child.`status` = 1,
    child.`auth_code` = NULL,
    child.`portal_type` = 'client';
