-- Client service uses its own host, so page routes no longer need the /client prefix.
UPDATE `sys_user`
SET `home_path` = '/home'
WHERE `portal_type` = 'client'
  AND (
    `home_path` IS NULL
    OR `home_path` = '/client'
    OR `home_path` LIKE '/client/%'
    OR `home_path` IN (
      '/Dashboard/Workspace',
      '/dashboard/workspace',
      '/dashboard/workbench',
      '/workspace'
    )
  );

UPDATE `sys_menu`
SET `path` = '/',
    `redirect_path` = '/home'
WHERE `portal_type` = 'client'
  AND `name` = 'Client';

UPDATE `sys_menu`
SET `path` = CASE `name`
    WHEN 'ClientEnterprise' THEN '/company/profile'
    WHEN 'ClientDeclare' THEN '/materials'
    WHEN 'ClientPolicy' THEN '/policy'
    WHEN 'ClientContent' THEN '/content'
    WHEN 'ClientEnterpriseOwner' THEN '/company/owners'
    WHEN 'ClientEnterpriseUser' THEN '/company/users'
    WHEN 'ClientPolicyQuery' THEN '/policy/query'
    ELSE `path`
  END
WHERE `portal_type` = 'client'
  AND `name` IN (
    'ClientEnterprise',
    'ClientDeclare',
    'ClientPolicy',
    'ClientContent',
    'ClientEnterpriseOwner',
    'ClientEnterpriseUser',
    'ClientPolicyQuery'
  );
