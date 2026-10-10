-- 总负责人直接管理企业负责人，不再通过区域负责人分发账号。
-- 不删除用户、企业资料或 biz_enterprise_teacher / biz_enterprise_owner 绑定。
-- 历史中间关系只停用，保留作审计；应用代码已不再读取这些关系。
-- 先补齐历史企业的地理归属，再停用中间链路。
UPDATE biz_enterprise e
JOIN biz_enterprise_teacher t ON t.enterprise_id = e.id AND t.status = 1
JOIN biz_region_project_user r ON r.user_id = t.teacher_user_id AND r.status = 1
SET e.region_id = r.region_id
WHERE e.region_id IS NULL;

-- 仅关闭被退役角色所在应用的客户端访问，不影响同一用户的其他应用或管理端。
UPDATE sys_user_app ua
JOIN sys_user_role ur ON ur.user_id = ua.user_id
JOIN sys_role r ON r.id = ur.role_id AND r.app_code = ua.app_code AND r.portal_type = ua.portal_type
SET ua.status = 0
WHERE r.code = 'region_leader' AND r.portal_type = 'client';
UPDATE sys_role SET status = 0 WHERE code = 'region_leader' AND portal_type = 'client';
UPDATE biz_region_project_user SET status = 0 WHERE status <> 0;
UPDATE biz_region SET leader_user_id = NULL, leader_name = NULL
WHERE leader_user_id IS NOT NULL OR leader_name IS NOT NULL;

UPDATE sys_menu SET status = 0
WHERE portal_type = 'client'
  AND (name IN ('ClientRegionAccounts', 'ClientRegionEnterprises')
    OR path IN ('/governance/project-accounts', '/governance/enterprises', '/governance/region-accounts'));
-- 保留 project_teacher 兼容角色和一账号多企业模型；修正旧登录首页。
UPDATE sys_user_app ua
JOIN sys_user_role ur ON ur.user_id = ua.user_id
JOIN sys_role r ON r.id = ur.role_id AND r.app_code = ua.app_code AND r.portal_type = ua.portal_type
SET ua.home_path = IF(r.code = 'global_leader', '/governance/regions', '/client/enterprise-receipts')
WHERE r.portal_type = 'client' AND r.code IN ('global_leader', 'project_teacher', 'enterprise_owner')
  AND ua.home_path IN ('/governance/enterprises', '/governance/project-accounts', '/governance/region-accounts');
