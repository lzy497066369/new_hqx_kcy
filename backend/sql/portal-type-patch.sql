-- 后台管理权限分端改造：sys_user/sys_role/sys_menu/sys_permission 增加 portal_type。
-- 约定：admin=后台端，client=客户端；sys_user 仍为共用主账号表。

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing $$
CREATE PROCEDURE add_column_if_missing(
  IN table_name_value VARCHAR(64),
  IN column_name_value VARCHAR(64),
  IN alter_sql_value TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_value
      AND COLUMN_NAME = column_name_value
  ) THEN
    SET @sql = alter_sql_value;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS drop_index_if_exists $$
CREATE PROCEDURE drop_index_if_exists(
  IN table_name_value VARCHAR(64),
  IN index_name_value VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_value
      AND INDEX_NAME = index_name_value
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', table_name_value, '` DROP INDEX `', index_name_value, '`');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_index_if_missing $$
CREATE PROCEDURE add_index_if_missing(
  IN table_name_value VARCHAR(64),
  IN index_name_value VARCHAR(64),
  IN alter_sql_value TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_value
      AND INDEX_NAME = index_name_value
  ) THEN
    SET @sql = alter_sql_value;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS assert_no_mixed_user_portals $$
CREATE PROCEDURE assert_no_mixed_user_portals()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT ur.`user_id`
      FROM `sys_user_role` ur
      JOIN `sys_role` r ON r.`id` = ur.`role_id`
      GROUP BY ur.`user_id`
      HAVING COUNT(DISTINCT r.`portal_type`) > 1
    ) mixed_users
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'mixed admin/client roles found; split those users before running portal-type-patch.sql';
  END IF;
END $$

DELIMITER ;

CALL add_column_if_missing(
  'sys_user',
  'portal_type',
  'ALTER TABLE `sys_user` ADD COLUMN `portal_type` VARCHAR(16) NOT NULL DEFAULT ''admin'' AFTER `id`'
);
CALL add_column_if_missing(
  'sys_role',
  'portal_type',
  'ALTER TABLE `sys_role` ADD COLUMN `portal_type` VARCHAR(16) NOT NULL DEFAULT ''admin'' AFTER `id`'
);
CALL add_column_if_missing(
  'sys_menu',
  'portal_type',
  'ALTER TABLE `sys_menu` ADD COLUMN `portal_type` VARCHAR(16) NOT NULL DEFAULT ''admin'' AFTER `id`'
);
CALL add_column_if_missing(
  'sys_permission',
  'portal_type',
  'ALTER TABLE `sys_permission` ADD COLUMN `portal_type` VARCHAR(16) NOT NULL DEFAULT ''admin'' AFTER `id`'
);

UPDATE `sys_role`
SET `portal_type` = 'client'
WHERE `code` IN ('enterprise_owner', 'enterprise_user');

UPDATE `sys_role`
SET `portal_type` = 'admin'
WHERE `code` = 'project_teacher';

CALL assert_no_mixed_user_portals();

UPDATE `sys_user` u
JOIN `sys_user_role` ur ON ur.`user_id` = u.`id`
JOIN `sys_role` r ON r.`id` = ur.`role_id`
SET u.`portal_type` = r.`portal_type`
WHERE r.`portal_type` = 'client';

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

UPDATE `sys_user`
SET `home_path` = '/home'
WHERE `portal_type` = 'client'
  AND (
    `home_path` IS NULL
    OR `home_path` IN (
      '/Dashboard/Workspace',
      '/dashboard/workspace',
      '/dashboard/workbench',
      '/workspace'
    )
  );

UPDATE `sys_user`
SET `home_path` = '/home'
WHERE `portal_type` = 'client'
  AND (`home_path` = '/client' OR `home_path` LIKE '/client/%');

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

UPDATE `sys_menu`
SET `portal_type` = 'client'
WHERE `name` = 'Client'
   OR `name` LIKE 'Client%'
   OR `path` = '/client'
   OR `path` LIKE '/client/%'
   OR `component` LIKE 'client/%'
   OR `auth_code` LIKE 'Client:%'
   OR `auth_code` LIKE 'AC_CLIENT_%';

UPDATE `sys_menu`
SET `status` = 1
WHERE `portal_type` = 'client'
  AND `name` = 'Client';

CALL drop_index_if_exists('sys_permission', 'uk_sys_permission_code');
CALL add_index_if_missing(
  'sys_permission',
  'idx_sys_permission_portal',
  'ALTER TABLE `sys_permission` ADD KEY `idx_sys_permission_portal` (`portal_type`)'
);

UPDATE `sys_permission` p
SET p.`portal_type` = 'client'
WHERE EXISTS (
    SELECT 1
    FROM `sys_menu` m
    WHERE m.`auth_code` = p.`code`
      AND m.`portal_type` = 'client'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_menu` m
    WHERE m.`auth_code` = p.`code`
      AND m.`portal_type` = 'admin'
  );

INSERT INTO `sys_permission` (
  `portal_type`,
  `code`,
  `name`,
  `type`,
  `status`,
  `created_at`,
  `updated_at`
)
SELECT
  'client',
  p.`code`,
  p.`name`,
  p.`type`,
  p.`status`,
  NOW(),
  NOW()
FROM `sys_permission` p
WHERE p.`portal_type` = 'admin'
  AND EXISTS (
    SELECT 1
    FROM `sys_menu` m
    WHERE m.`auth_code` = p.`code`
      AND m.`portal_type` = 'client'
  )
  AND EXISTS (
    SELECT 1
    FROM `sys_menu` m
    WHERE m.`auth_code` = p.`code`
      AND m.`portal_type` = 'admin'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_permission` existed
    WHERE existed.`code` = p.`code`
      AND existed.`portal_type` = 'client'
  );

UPDATE `sys_role_permission` rp
JOIN `sys_role` r ON r.`id` = rp.`role_id`
JOIN `sys_permission` old_p ON old_p.`id` = rp.`permission_id`
JOIN `sys_permission` new_p
  ON new_p.`code` = old_p.`code`
 AND new_p.`portal_type` = r.`portal_type`
SET rp.`permission_id` = new_p.`id`
WHERE old_p.`portal_type` <> r.`portal_type`;

DELETE rp
FROM `sys_role_permission` rp
JOIN `sys_role` r ON r.`id` = rp.`role_id`
JOIN `sys_permission` p ON p.`id` = rp.`permission_id`
WHERE r.`portal_type` <> p.`portal_type`;

CALL drop_index_if_exists('sys_role', 'uk_sys_role_code');
CALL add_index_if_missing(
  'sys_role',
  'uk_sys_role_portal_code',
  'ALTER TABLE `sys_role` ADD UNIQUE KEY `uk_sys_role_portal_code` (`portal_type`, `code`)'
);
CALL add_index_if_missing(
  'sys_user',
  'idx_sys_user_portal',
  'ALTER TABLE `sys_user` ADD KEY `idx_sys_user_portal` (`portal_type`)'
);
CALL add_index_if_missing(
  'sys_menu',
  'idx_sys_menu_portal',
  'ALTER TABLE `sys_menu` ADD KEY `idx_sys_menu_portal` (`portal_type`)'
);
CALL add_index_if_missing(
  'sys_menu',
  'idx_sys_menu_portal_parent',
  'ALTER TABLE `sys_menu` ADD KEY `idx_sys_menu_portal_parent` (`portal_type`, `parent_id`)'
);
CALL add_index_if_missing(
  'sys_permission',
  'uk_sys_permission_portal_code',
  'ALTER TABLE `sys_permission` ADD UNIQUE KEY `uk_sys_permission_portal_code` (`portal_type`, `code`)'
);

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS drop_index_if_exists;
DROP PROCEDURE IF EXISTS add_index_if_missing;
DROP PROCEDURE IF EXISTS assert_no_mixed_user_portals;
