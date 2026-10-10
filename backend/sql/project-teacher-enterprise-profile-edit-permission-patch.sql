-- 项目老师可编辑企业工作台资料并创建申报草稿。
INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT role.`id`, permission.`id`, NOW(), NOW()
FROM `sys_role` role
JOIN `sys_permission` permission
  ON permission.`code` = 'Enterprise:Profile:Edit'
WHERE role.`portal_type` = 'admin'
  AND role.`code` = 'project_teacher'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` role_permission
    WHERE role_permission.`role_id` = role.`id`
      AND role_permission.`permission_id` = permission.`id`
  );
