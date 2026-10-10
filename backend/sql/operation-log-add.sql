-- 旧环境首次补齐操作日志功能时执行本文件。
-- 如果不确定环境当前是否已有半成品结构，优先执行 operation-log-patch.sql。

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

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'System:OperationLog:List', '操作日志列表', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_permission` WHERE `code` = 'System:OperationLog:List'
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
    SELECT 1 FROM `sys_menu` WHERE `name` = 'SystemOperationLog'
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'System:OperationLog:List'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
