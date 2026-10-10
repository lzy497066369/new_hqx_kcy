-- Authentication application scope foundation. Existing KJQB data remains in app_code=kjqb.

CREATE TABLE IF NOT EXISTS `sys_app` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `default_portal` VARCHAR(16) NOT NULL DEFAULT 'admin',
  `remark` VARCHAR(255) DEFAULT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_app_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_app_client` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `app_code` VARCHAR(64) NOT NULL,
  `client_id` VARCHAR(128) NOT NULL,
  `client_type` VARCHAR(32) NOT NULL DEFAULT 'public',
  `redirect_uris` TEXT NULL,
  `post_logout_redirect_uris` TEXT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_app_client_id` (`client_id`),
  KEY `idx_sys_app_client_app` (`app_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_user_app` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `app_code` VARCHAR(64) NOT NULL,
  `portal_type` VARCHAR(16) NOT NULL DEFAULT 'admin',
  `home_path` VARCHAR(255) DEFAULT NULL,
  `is_default` TINYINT NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_user_app_portal` (`user_id`, `app_code`, `portal_type`),
  KEY `idx_sys_user_app_user` (`user_id`),
  KEY `idx_sys_user_app_app_portal` (`app_code`, `portal_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_auth_app_column_if_missing $$
CREATE PROCEDURE add_auth_app_column_if_missing(
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
    SET @auth_app_scope_sql = alter_sql_value;
    PREPARE auth_app_scope_stmt FROM @auth_app_scope_sql;
    EXECUTE auth_app_scope_stmt;
    DEALLOCATE PREPARE auth_app_scope_stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS drop_auth_app_index_if_exists $$
CREATE PROCEDURE drop_auth_app_index_if_exists(
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
    SET @auth_app_scope_sql = CONCAT('ALTER TABLE `', table_name_value, '` DROP INDEX `', index_name_value, '`');
    PREPARE auth_app_scope_stmt FROM @auth_app_scope_sql;
    EXECUTE auth_app_scope_stmt;
    DEALLOCATE PREPARE auth_app_scope_stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_auth_app_index_if_missing $$
CREATE PROCEDURE add_auth_app_index_if_missing(
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
    SET @auth_app_scope_sql = alter_sql_value;
    PREPARE auth_app_scope_stmt FROM @auth_app_scope_sql;
    EXECUTE auth_app_scope_stmt;
    DEALLOCATE PREPARE auth_app_scope_stmt;
  END IF;
END $$

DELIMITER ;

CALL add_auth_app_column_if_missing(
  'sys_role',
  'app_code',
  'ALTER TABLE `sys_role` ADD COLUMN `app_code` VARCHAR(64) NOT NULL DEFAULT ''kjqb'' AFTER `portal_type`'
);
CALL add_auth_app_column_if_missing(
  'sys_permission',
  'app_code',
  'ALTER TABLE `sys_permission` ADD COLUMN `app_code` VARCHAR(64) NOT NULL DEFAULT ''kjqb'' AFTER `portal_type`'
);
CALL add_auth_app_column_if_missing(
  'sys_menu',
  'app_code',
  'ALTER TABLE `sys_menu` ADD COLUMN `app_code` VARCHAR(64) NOT NULL DEFAULT ''kjqb'' AFTER `portal_type`'
);

UPDATE `sys_role` SET `app_code` = 'kjqb' WHERE `app_code` IS NULL OR TRIM(`app_code`) = '';
UPDATE `sys_permission` SET `app_code` = 'kjqb' WHERE `app_code` IS NULL OR TRIM(`app_code`) = '';
UPDATE `sys_menu` SET `app_code` = 'kjqb' WHERE `app_code` IS NULL OR TRIM(`app_code`) = '';

INSERT INTO `sys_app` (`code`, `name`, `default_portal`, `status`, `created_at`, `updated_at`)
SELECT 'kjqb', '科创企服', 'admin', 1, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_app` WHERE `code` = 'kjqb'
);

INSERT INTO `sys_user_app` (
  `user_id`, `app_code`, `portal_type`, `home_path`, `is_default`, `status`, `created_at`, `updated_at`
)
SELECT u.`id`, 'kjqb', u.`portal_type`, u.`home_path`, 1, u.`status`, NOW(), NOW()
FROM `sys_user` u
WHERE NOT EXISTS (
  SELECT 1
  FROM `sys_user_app` ua
  WHERE ua.`user_id` = u.`id`
    AND ua.`app_code` = 'kjqb'
    AND ua.`portal_type` = u.`portal_type`
);

CALL drop_auth_app_index_if_exists('sys_role', 'uk_sys_role_portal_code');
CALL add_auth_app_index_if_missing(
  'sys_role',
  'uk_sys_role_app_portal_code',
  'ALTER TABLE `sys_role` ADD UNIQUE KEY `uk_sys_role_app_portal_code` (`app_code`, `portal_type`, `code`)'
);

CALL drop_auth_app_index_if_exists('sys_permission', 'uk_sys_permission_portal_code');
CALL add_auth_app_index_if_missing(
  'sys_permission',
  'uk_sys_permission_app_portal_code',
  'ALTER TABLE `sys_permission` ADD UNIQUE KEY `uk_sys_permission_app_portal_code` (`app_code`, `portal_type`, `code`)'
);

CALL add_auth_app_index_if_missing(
  'sys_menu',
  'idx_sys_menu_app_portal',
  'ALTER TABLE `sys_menu` ADD KEY `idx_sys_menu_app_portal` (`app_code`, `portal_type`)'
);
CALL add_auth_app_index_if_missing(
  'sys_menu',
  'idx_sys_menu_app_portal_parent',
  'ALTER TABLE `sys_menu` ADD KEY `idx_sys_menu_app_portal_parent` (`app_code`, `portal_type`, `parent_id`)'
);

DROP PROCEDURE IF EXISTS add_auth_app_column_if_missing;
DROP PROCEDURE IF EXISTS drop_auth_app_index_if_exists;
DROP PROCEDURE IF EXISTS add_auth_app_index_if_missing;
