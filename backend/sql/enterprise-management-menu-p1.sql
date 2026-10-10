-- 将后台企业功能收拢到“企业管理”目录。可重复执行。
UPDATE `sys_menu`
SET `title` = '企业管理', `updated_at` = NOW()
WHERE `portal_type` = 'admin'
  AND `app_code` = 'kjqb'
  AND `name` IN ('EnterpriseServiceStatistics', 'EnterpriseWorkspace');

UPDATE `sys_menu` child
JOIN `sys_menu` parent
  ON parent.`portal_type` = 'admin'
 AND parent.`app_code` = child.`app_code`
 AND parent.`name` = 'EnterpriseServiceStatistics'
SET child.`parent_id` = parent.`id`,
    child.`order_num` = CASE child.`name`
      WHEN 'EnterpriseMaterialLedger' THEN 2
      WHEN 'EnterpriseDeclarationManagement' THEN 3
    END,
    child.`updated_at` = NOW()
WHERE child.`portal_type` = 'admin'
  AND child.`app_code` = 'kjqb'
  AND child.`name` IN ('EnterpriseMaterialLedger', 'EnterpriseDeclarationManagement');
