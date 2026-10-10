-- 仅修正已存在的 sys_operation_log 表结构。
-- 适用于历史环境已经手工建过表，但字段默认值或索引不完整的情况。

SET @@session.time_zone = '+08:00';

SET @has_table := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_operation_log'
);
SET @has_created_at_default := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_operation_log'
    AND COLUMN_NAME = 'created_at'
    AND COLUMN_DEFAULT = 'CURRENT_TIMESTAMP'
);
SET @has_updated_at_default := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_operation_log'
    AND COLUMN_NAME = 'updated_at'
    AND COLUMN_DEFAULT = 'CURRENT_TIMESTAMP'
    AND EXTRA LIKE '%on update CURRENT_TIMESTAMP%'
);
SET @has_user_agent := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_operation_log'
    AND COLUMN_NAME = 'user_agent'
);
SET @has_user_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_operation_log'
    AND COLUMN_NAME = 'user_id'
);
SET @has_module_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_operation_log'
    AND COLUMN_NAME = 'module'
);
SET @has_action_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_operation_log'
    AND COLUMN_NAME = 'action'
);
SET @has_created_at_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_operation_log'
    AND COLUMN_NAME = 'created_at'
);

SET @sql := IF(
  @has_table = 1 AND @has_created_at_default = 0,
  'ALTER TABLE `sys_operation_log` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  @has_table = 1 AND @has_updated_at_default = 0,
  'ALTER TABLE `sys_operation_log` MODIFY COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  @has_table = 1 AND @has_user_agent = 0,
  'ALTER TABLE `sys_operation_log` ADD COLUMN `user_agent` VARCHAR(255) DEFAULT NULL AFTER `ip`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  @has_table = 1 AND @has_user_idx = 0,
  'ALTER TABLE `sys_operation_log` ADD KEY `idx_sys_operation_log_user_id` (`user_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  @has_table = 1 AND @has_module_idx = 0,
  'ALTER TABLE `sys_operation_log` ADD KEY `idx_sys_operation_log_module` (`module`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  @has_table = 1 AND @has_action_idx = 0,
  'ALTER TABLE `sys_operation_log` ADD KEY `idx_sys_operation_log_action` (`action`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  @has_table = 1 AND @has_created_at_idx = 0,
  'ALTER TABLE `sys_operation_log` ADD KEY `idx_sys_operation_log_created_at` (`created_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
