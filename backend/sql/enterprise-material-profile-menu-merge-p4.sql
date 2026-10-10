-- Merge enterprise contacts into the basic profile page and remove the separate menu entry.
UPDATE `sys_menu`
SET `path` = 'basic',
    `title` = '企业基础档案',
    `updated_at` = NOW()
WHERE `portal_type` = 'admin'
  AND `name` = 'EnterpriseMaterialBasic';

DELETE FROM `sys_menu`
WHERE `portal_type` = 'admin'
  AND `name` = 'EnterpriseMaterialContacts';
