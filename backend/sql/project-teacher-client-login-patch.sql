-- 项目老师账号归后台端维护，但允许登录客户端并获取客户端全量路由。

UPDATE `sys_role`
SET `portal_type` = 'admin'
WHERE `code` = 'project_teacher';

UPDATE `sys_user` u
JOIN `sys_user_role` ur ON ur.`user_id` = u.`id`
JOIN `sys_role` r ON r.`id` = ur.`role_id`
SET u.`portal_type` = 'admin',
    u.`home_path` = CASE
      WHEN u.`home_path` IS NULL OR u.`home_path` LIKE '/client/%'
        THEN '/Dashboard/Workspace'
      ELSE u.`home_path`
    END
WHERE r.`code` = 'project_teacher';

UPDATE `sys_role`
SET `portal_type` = 'client'
WHERE `code` IN ('enterprise_owner', 'enterprise_user');
