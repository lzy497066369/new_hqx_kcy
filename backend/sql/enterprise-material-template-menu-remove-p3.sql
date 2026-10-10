-- Remove the template center from the enterprise material ledger navigation.
DELETE FROM `sys_menu`
WHERE `portal_type` = 'admin'
  AND `name` = 'EnterpriseMaterialTemplates';
