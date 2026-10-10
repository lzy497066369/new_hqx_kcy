-- 企业材料台账菜单顺序。可重复执行。
UPDATE `sys_menu`
SET `order_num` = CASE `name`
  WHEN 'EnterpriseMaterialOverview' THEN 1
  WHEN 'EnterpriseMaterialBasic' THEN 2
  WHEN 'EnterpriseMaterialEmployees' THEN 3
  WHEN 'EnterpriseMaterialFinance' THEN 4
  WHEN 'EnterpriseMaterialContracts' THEN 5
  WHEN 'EnterpriseMaterialProperties' THEN 6
  WHEN 'EnterpriseMaterialDocuments' THEN 7
  WHEN 'EnterpriseMaterialCertificates' THEN 8
  WHEN 'EnterpriseMaterialPhotos' THEN 9
  WHEN 'EnterpriseMaterialAccounts' THEN 10
END,
`updated_at` = NOW()
WHERE `portal_type` = 'admin'
  AND `name` IN (
    'EnterpriseMaterialOverview',
    'EnterpriseMaterialBasic',
    'EnterpriseMaterialEmployees',
    'EnterpriseMaterialFinance',
    'EnterpriseMaterialContracts',
    'EnterpriseMaterialProperties',
    'EnterpriseMaterialDocuments',
    'EnterpriseMaterialCertificates',
    'EnterpriseMaterialPhotos',
    'EnterpriseMaterialAccounts'
  );
