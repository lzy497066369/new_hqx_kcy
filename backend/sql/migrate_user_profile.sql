SET @has_phone := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_user'
    AND COLUMN_NAME = 'phone'
);
SET @sql := IF(@has_phone = 0, 'ALTER TABLE `sys_user` ADD COLUMN `phone` VARCHAR(32) DEFAULT NULL AFTER `home_path`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_avatar_path := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_user'
    AND COLUMN_NAME = 'avatar_path'
);
SET @sql := IF(@has_avatar_path = 0, 'ALTER TABLE `sys_user` ADD COLUMN `avatar_path` VARCHAR(500) DEFAULT NULL AFTER `home_path`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_email := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_user'
    AND COLUMN_NAME = 'email'
);
SET @sql := IF(@has_email = 0, 'ALTER TABLE `sys_user` ADD COLUMN `email` VARCHAR(128) DEFAULT NULL AFTER `phone`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_remark := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_user'
    AND COLUMN_NAME = 'remark'
);
SET @sql := IF(@has_remark = 0, 'ALTER TABLE `sys_user` ADD COLUMN `remark` VARCHAR(255) DEFAULT NULL AFTER `email`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
