-- 旧环境升级的推荐脚本。
-- 作用：
-- 1. 没有 sys_operation_log 表时自动创建。
-- 2. 已有旧表时补齐 user_agent、时间列默认值和查询索引。
-- 3. 补齐操作日志菜单、权限和 admin 角色关联。

SET @@session.time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS `sys_operation_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT DEFAULT NULL,
  `user_name` VARCHAR(64) DEFAULT NULL,
  `real_name` VARCHAR(64) DEFAULT NULL,
  `module` VARCHAR(64) NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `biz_id` VARCHAR(64) DEFAULT NULL,
  `request_path` VARCHAR(255) DEFAULT NULL,
  `method` VARCHAR(16) DEFAULT NULL,
  `params_text` TEXT DEFAULT NULL,
  `result_text` TEXT DEFAULT NULL,
  `success` TINYINT NOT NULL DEFAULT 1,
  `error_message` VARCHAR(255) DEFAULT NULL,
  `cost` INT NOT NULL DEFAULT 0,
  `ip` VARCHAR(64) DEFAULT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sys_operation_log_user_id` (`user_id`),
  KEY `idx_sys_operation_log_module` (`module`),
  KEY `idx_sys_operation_log_action` (`action`),
  KEY `idx_sys_operation_log_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  @has_created_at_default = 0,
  'ALTER TABLE `sys_operation_log` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  @has_updated_at_default = 0,
  'ALTER TABLE `sys_operation_log` MODIFY COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  @has_user_agent = 0,
  'ALTER TABLE `sys_operation_log` ADD COLUMN `user_agent` VARCHAR(255) DEFAULT NULL AFTER `ip`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  @has_user_idx = 0,
  'ALTER TABLE `sys_operation_log` ADD KEY `idx_sys_operation_log_user_id` (`user_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  @has_module_idx = 0,
  'ALTER TABLE `sys_operation_log` ADD KEY `idx_sys_operation_log_module` (`module`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  @has_action_idx = 0,
  'ALTER TABLE `sys_operation_log` ADD KEY `idx_sys_operation_log_action` (`action`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  @has_created_at_idx = 0,
  'ALTER TABLE `sys_operation_log` ADD KEY `idx_sys_operation_log_created_at` (`created_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'System:OperationLog:List', '操作日志列表', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM `sys_permission`
  WHERE `code` = 'System:OperationLog:List'
);

INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT
  parent.id,
  'SystemOperationLog',
  'operation-log',
  'system/operation-log/list',
  NULL,
  'menu',
  'ion:list-outline',
  'system.operationLog.title',
  5,
  1,
  'System:OperationLog:List',
  NOW(),
  NOW()
FROM `sys_menu` parent
WHERE parent.path = '/system'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_menu`
    WHERE `name` = 'SystemOperationLog'
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'System:OperationLog:List'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );
