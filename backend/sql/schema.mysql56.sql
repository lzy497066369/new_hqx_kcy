-- MySQL 5.6.50-log 全量初始化脚本：线上新环境优先执行本文件。

CREATE TABLE IF NOT EXISTS `sys_user` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `portal_type` VARCHAR(16) NOT NULL DEFAULT 'admin',
  `username` VARCHAR(64) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `real_name` VARCHAR(64) NOT NULL,
  `home_path` VARCHAR(255) DEFAULT NULL,
  `avatar_path` VARCHAR(500) DEFAULT NULL,
  `phone` VARCHAR(32) DEFAULT NULL,
  `email` VARCHAR(128) DEFAULT NULL,
  `dept_id` BIGINT DEFAULT NULL,
  `dept_name` VARCHAR(64) DEFAULT NULL,
  `remark` VARCHAR(255) DEFAULT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sys_user_portal` (`portal_type`),
  UNIQUE KEY `uk_sys_user_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE TABLE IF NOT EXISTS `sys_role` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `portal_type` VARCHAR(16) NOT NULL DEFAULT 'admin',
  `app_code` VARCHAR(64) NOT NULL DEFAULT 'kjqb',
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `remark` VARCHAR(255) DEFAULT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_role_app_portal_code` (`app_code`, `portal_type`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_user_role` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `role_id` BIGINT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_user_role` (`user_id`, `role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_permission` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `portal_type` VARCHAR(16) NOT NULL DEFAULT 'admin',
  `app_code` VARCHAR(64) NOT NULL DEFAULT 'kjqb',
  `code` VARCHAR(128) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `type` VARCHAR(32) NOT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sys_permission_portal` (`portal_type`),
  UNIQUE KEY `uk_sys_permission_app_portal_code` (`app_code`, `portal_type`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_role_permission` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `role_id` BIGINT NOT NULL,
  `permission_id` BIGINT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_role_permission` (`role_id`, `permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_dept` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `parent_id` BIGINT DEFAULT NULL,
  `name` VARCHAR(64) NOT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `remark` VARCHAR(255) DEFAULT NULL,
  `sort_num` INT NOT NULL DEFAULT 0,
  `ancestors` VARCHAR(255) DEFAULT NULL,
  `dept_type` VARCHAR(32) NOT NULL DEFAULT 'dept',
  `parent_name` VARCHAR(64) DEFAULT NULL,
  `full_name` VARCHAR(128) DEFAULT NULL,
  `path` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(32) DEFAULT NULL,
  `email` VARCHAR(128) DEFAULT NULL,
  `leader` VARCHAR(64) DEFAULT NULL,
  `children_count` INT NOT NULL DEFAULT 0,
  `is_leaf` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sys_dept_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_menu` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `portal_type` VARCHAR(16) NOT NULL DEFAULT 'admin',
  `app_code` VARCHAR(64) NOT NULL DEFAULT 'kjqb',
  `parent_id` BIGINT DEFAULT NULL,
  `name` VARCHAR(128) NOT NULL,
  `path` VARCHAR(255) NOT NULL,
  `component` VARCHAR(255) DEFAULT NULL,
  `redirect_path` VARCHAR(255) DEFAULT NULL,
  `menu_type` VARCHAR(32) NOT NULL,
  `icon` VARCHAR(128) DEFAULT NULL,
  `title` VARCHAR(128) NOT NULL,
  `order_num` INT NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 1,
  `auth_code` VARCHAR(128) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sys_menu_portal` (`portal_type`),
  KEY `idx_sys_menu_app_portal` (`app_code`, `portal_type`),
  KEY `idx_sys_menu_app_portal_parent` (`app_code`, `portal_type`, `parent_id`),
  KEY `idx_sys_menu_portal_parent` (`portal_type`, `parent_id`),
  KEY `idx_sys_menu_parent` (`parent_id`),
  KEY `idx_sys_menu_path` (`path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE TABLE IF NOT EXISTS `biz_region` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `parent_id` BIGINT DEFAULT NULL,
  `name` VARCHAR(64) NOT NULL,
  `level` VARCHAR(16) NOT NULL,
  `leader_user_id` BIGINT DEFAULT NULL,
  `leader_name` VARCHAR(64) DEFAULT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `sort_num` INT NOT NULL DEFAULT 0,
  `remark` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_region_parent` (`parent_id`),
  KEY `idx_biz_region_level` (`level`),
  KEY `idx_biz_region_leader` (`leader_user_id`),
  KEY `idx_biz_region_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_policy_project` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `policy_type` VARCHAR(128) DEFAULT NULL,
  `applicable_objects` VARCHAR(255) DEFAULT NULL,
  `basic_description` TEXT DEFAULT NULL,
  `enabled` TINYINT NOT NULL DEFAULT 1,
  `sort_num` INT NOT NULL DEFAULT 0,
  `remark` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_policy_project_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_region_project_user` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `region_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_region_project_user_user` (`user_id`),
  KEY `idx_biz_region_project_user_region` (`region_id`),
  CONSTRAINT `fk_biz_region_project_user_region` FOREIGN KEY (`region_id`) REFERENCES `biz_region` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_biz_region_project_user_user` FOREIGN KEY (`user_id`) REFERENCES `sys_user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_region_policy_file` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `region_id` BIGINT NOT NULL,
  `region_name` VARCHAR(64) NOT NULL,
  `project_id` BIGINT NOT NULL,
  `project_name` VARCHAR(128) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'incomplete',
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT DEFAULT NULL,
  `start_date` DATE DEFAULT NULL,
  `end_date` DATE DEFAULT NULL,
  `subsidy_amount_min` DECIMAL(12,2) DEFAULT NULL,
  `subsidy_amount_max` DECIMAL(12,2) DEFAULT NULL,
  `subsidy_text` VARCHAR(255) DEFAULT NULL,
  `application_level` VARCHAR(32) DEFAULT NULL,
  `condition_text` TEXT DEFAULT NULL,
  `material_text` TEXT DEFAULT NULL,
  `target_objects` VARCHAR(255) DEFAULT NULL,
  `official_file_url` VARCHAR(500) DEFAULT NULL,
  `file_url` VARCHAR(500) DEFAULT NULL,
  `file_name` VARCHAR(255) DEFAULT NULL,
  `template_file_id` BIGINT DEFAULT NULL,
  `template_file_name` VARCHAR(255) DEFAULT NULL,
  `owner_user_id` BIGINT NOT NULL,
  `owner_name` VARCHAR(64) NOT NULL,
  `remark` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_region_policy_file_region` (`region_id`),
  KEY `idx_biz_region_policy_file_project` (`project_id`),
  KEY `idx_biz_region_policy_file_status` (`status`),
  KEY `idx_biz_region_policy_file_template` (`template_file_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_client_declaration` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `declaration_no` VARCHAR(64) NOT NULL,
  `enterprise_id` BIGINT NOT NULL,
  `enterprise_name` VARCHAR(128) NOT NULL,
  `project_id` BIGINT NOT NULL,
  `project_name` VARCHAR(128) NOT NULL,
  `policy_type` VARCHAR(128) DEFAULT NULL,
  `policy_file_ids` VARCHAR(500) DEFAULT NULL,
  `declaration_region_id` BIGINT DEFAULT NULL,
  `scheme_id` BIGINT DEFAULT NULL,
  `scheme_version` VARCHAR(32) DEFAULT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `current_node_name` VARCHAR(128) DEFAULT NULL,
  `progress` INT NOT NULL DEFAULT 0,
  `deadline` DATE DEFAULT NULL,
  `missing_material_count` INT NOT NULL DEFAULT 0,
  `rejected_reason` VARCHAR(500) DEFAULT NULL,
  `submit_time` DATETIME DEFAULT NULL,
  `snapshot_json` LONGTEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_client_declaration_no` (`declaration_no`),
  KEY `idx_biz_client_declaration_enterprise` (`enterprise_id`),
  KEY `idx_biz_client_declaration_project` (`project_id`),
  KEY `idx_biz_client_declaration_enterprise_project_region` (`enterprise_id`, `project_id`, `declaration_region_id`),
  KEY `idx_biz_client_declaration_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_declaration_scheme` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `project_id` BIGINT NOT NULL,
  `region_id` BIGINT DEFAULT NULL,
  `scheme_name` VARCHAR(128) NOT NULL,
  `version` VARCHAR(32) NOT NULL DEFAULT 'v1',
  `status` VARCHAR(16) NOT NULL DEFAULT 'draft',
  `effective_start_date` DATE DEFAULT NULL,
  `effective_end_date` DATE DEFAULT NULL,
  `enterprise_preset_id` BIGINT DEFAULT NULL,
  `enterprise_preset_json` LONGTEXT DEFAULT NULL,
  `qualification_preset_id` BIGINT DEFAULT NULL,
  `qualification_rules_json` LONGTEXT DEFAULT NULL,
  `material_preset_id` BIGINT DEFAULT NULL,
  `material_rules_json` LONGTEXT DEFAULT NULL,
  `score_preset_id` BIGINT DEFAULT NULL,
  `score_rules_json` LONGTEXT DEFAULT NULL,
  `flow_preset_id` BIGINT DEFAULT NULL,
  `flow_template_json` LONGTEXT DEFAULT NULL,
  `capabilities_json` LONGTEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_declaration_scheme_project_status` (`project_id`, `status`),
  KEY `idx_biz_declaration_scheme_region_status` (`region_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_declaration_preset` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `preset_type` VARCHAR(32) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `version` VARCHAR(32) NOT NULL DEFAULT 'v1',
  `status` VARCHAR(16) NOT NULL DEFAULT 'draft',
  `description` VARCHAR(500) DEFAULT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_declaration_preset_type_name_version` (`preset_type`, `name`, `version`),
  KEY `idx_declaration_preset_type_status` (`preset_type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @@session.time_zone = '+08:00';

INSERT INTO `sys_dept` (
  `parent_id`,
  `name`,
  `status`,
  `remark`,
  `sort_num`,
  `ancestors`,
  `dept_type`,
  `parent_name`,
  `full_name`,
  `path`,
  `phone`,
  `email`,
  `leader`,
  `children_count`,
  `is_leaf`,
  `created_at`,
  `updated_at`
)
SELECT NULL, '总部', 1, '默认部门', 0, NULL, 'dept', NULL, '总部', NULL, NULL, NULL, NULL, 0, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_dept` WHERE `name` = '总部');

INSERT INTO `sys_user` (
  `username`,
  `password`,
  `real_name`,
  `home_path`,
  `dept_id`,
  `dept_name`,
  `status`,
  `created_at`,
  `updated_at`
)
SELECT
  'admin',
  '123456',
  '系统管理员',
  '/Dashboard/Workspace',
  (SELECT d.id FROM `sys_dept` d WHERE d.name = '总部' ORDER BY d.id ASC LIMIT 1),
  (SELECT d.name FROM `sys_dept` d WHERE d.name = '总部' ORDER BY d.id ASC LIMIT 1),
  1,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_user` WHERE `username` = 'admin');

INSERT INTO `sys_role` (`code`, `name`, `remark`, `status`, `created_at`, `updated_at`)
SELECT 'admin', '系统管理员', '默认管理员角色', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_role` WHERE `code` = 'admin');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AC_100100', '超级管理员权限', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AC_100100');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AC_100030', '管理员权限', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AC_100030');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'System:Menu:List', '菜单列表', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'System:Menu:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'System:Menu:Create', '新增菜单', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'System:Menu:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'System:Menu:Edit', '编辑菜单', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'System:Menu:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'System:Menu:Delete', '删除菜单', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'System:Menu:Delete');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'System:Dept:List', '部门列表', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'System:Dept:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'System:Dept:Create', '新增部门', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'System:Dept:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'System:Dept:Edit', '编辑部门', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'System:Dept:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'System:Dept:Delete', '删除部门', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'System:Dept:Delete');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'System:User:List', '用户列表', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'System:User:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'System:User:Create', '新增用户', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'System:User:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'System:User:Edit', '编辑用户', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'System:User:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'System:User:Delete', '删除用户', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'System:User:Delete');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'System:OperationLog:List', '操作日志列表', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'System:OperationLog:List');

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'AC_100100'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'AC_100030'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'System:Menu:List'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'System:Menu:Create'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'System:Menu:Edit'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'System:Menu:Delete'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'System:Dept:List'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'System:Dept:Create'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'System:Dept:Edit'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'System:Dept:Delete'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'System:User:List'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'System:User:Create'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'System:User:Edit'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'System:User:Delete'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
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

INSERT INTO `sys_user_role` (`user_id`, `role_id`, `created_at`, `updated_at`)
SELECT u.id, r.id, NOW(), NOW()
FROM `sys_user` u
JOIN `sys_role` r ON r.code = 'admin'
WHERE u.username = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_user_role` ur
    WHERE ur.user_id = u.id AND ur.role_id = r.id
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
SELECT NULL, 'dashboard', '/Dashboard', NULL, '/Dashboard/Workspace', 'catalog', 'lucide:layout-dashboard', 'page.dashboard.title', 1, 1, NULL, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `path` = '/Dashboard');

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
SELECT id, 'dashboard-workspace', '/Dashboard/Workspace', 'dashboard/workspace/index', NULL, 'menu', 'carbon:workspace', 'page.dashboard.workspace', 1, 1, NULL, NOW(), NOW()
FROM `sys_menu`
WHERE `path` = '/Dashboard'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'dashboard-workspace');

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
SELECT id, 'dashboard-analytics', '/Dashboard/Analytics', 'dashboard/analytics/index', NULL, 'menu', 'lucide:area-chart', 'page.dashboard.analytics', 2, 1, NULL, NOW(), NOW()
FROM `sys_menu`
WHERE `path` = '/Dashboard'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'dashboard-analytics');

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
SELECT NULL, 'system', '/system', NULL, '/system/user', 'catalog', 'lucide:users', 'system.name', 2, 1, 'AC_100100', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `path` = '/system');

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
SELECT id, 'system-user', 'user', 'system/user/list', NULL, 'menu', NULL, 'system.user.name', 1, 1, 'AC_100100', NOW(), NOW()
FROM `sys_menu`
WHERE `path` = '/system'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'system-user');

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
SELECT id, 'system-role', 'role', 'system/role/list', NULL, 'menu', NULL, 'system.role.name', 2, 1, 'AC_100100', NOW(), NOW()
FROM `sys_menu`
WHERE `path` = '/system'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'system-role');

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
SELECT id, 'system-menu', 'menu', 'system/menu/list', NULL, 'menu', NULL, 'system.menu.name', 3, 1, 'AC_100100', NOW(), NOW()
FROM `sys_menu`
WHERE `path` = '/system'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'system-menu');

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
SELECT id, 'system-dept', 'dept', 'system/dept/list', NULL, 'menu', NULL, 'system.dept.name', 4, 1, 'AC_100100', NOW(), NOW()
FROM `sys_menu`
WHERE `path` = '/system'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'system-dept');

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
SELECT id, 'SystemOperationLog', 'operation-log', 'system/operation-log/list', NULL, 'menu', 'ion:list-outline', 'system.operationLog.title', 5, 1, 'System:OperationLog:List', NOW(), NOW()
FROM `sys_menu`
WHERE `path` = '/system'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'SystemOperationLog');

CREATE TABLE IF NOT EXISTS `biz_enterprise` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `short_name` VARCHAR(128) DEFAULT NULL,
  `credit_code` VARCHAR(64) NOT NULL,
  `legal_person` VARCHAR(64) DEFAULT NULL,
  `contact_name` VARCHAR(64) DEFAULT NULL,
  `contact_phone` VARCHAR(32) DEFAULT NULL,
  `contact_email` VARCHAR(128) DEFAULT NULL,
  `industry` VARCHAR(128) DEFAULT NULL,
  `enterprise_type` VARCHAR(64) DEFAULT NULL,
  `province` VARCHAR(64) DEFAULT NULL,
  `city` VARCHAR(64) DEFAULT NULL,
  `district` VARCHAR(64) DEFAULT NULL,
  `address` VARCHAR(255) DEFAULT NULL,
  `profile_status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `status` TINYINT NOT NULL DEFAULT 1,
  `source` VARCHAR(64) DEFAULT NULL,
  `remark` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_enterprise_code` (`code`),
  UNIQUE KEY `uk_biz_enterprise_credit_code` (`credit_code`),
  KEY `idx_biz_enterprise_name` (`name`),
  KEY `idx_biz_enterprise_status` (`status`),
  KEY `idx_biz_enterprise_profile_status` (`profile_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Profile:List', '企业资料列表', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Profile:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Profile:Create', '新增企业资料', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Profile:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Profile:Edit', '编辑企业资料', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Profile:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Profile:Delete', '删除企业资料', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Profile:Delete');

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'Enterprise:Profile:List'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'Enterprise:Profile:Create'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'Enterprise:Profile:Edit'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'Enterprise:Profile:Delete'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
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
SELECT NULL, 'enterprise', '/enterprise', NULL, '/enterprise/profile', 'catalog', 'mdi:domain', 'system.enterprise.title', 3, 1, 'Enterprise:Profile:List', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `path` = '/enterprise');

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
SELECT id, 'enterprise-profile', 'profile', 'enterprise/profile/list', NULL, 'menu', NULL, 'system.enterprise.profile.name', 1, 1, 'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu`
WHERE `path` = '/enterprise'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'enterprise-profile');

CREATE TABLE IF NOT EXISTS `biz_enterprise_basic_info` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `enterprise_id` BIGINT NOT NULL,
  `tyc_enterprise_id` VARCHAR(64) DEFAULT NULL,
  `name` VARCHAR(128) NOT NULL,
  `alias` VARCHAR(128) DEFAULT NULL,
  `history_names` LONGTEXT,
  `reg_status` VARCHAR(64) DEFAULT NULL,
  `legal_person_name` VARCHAR(64) DEFAULT NULL,
  `legal_person_type` VARCHAR(64) DEFAULT NULL,
  `credit_code` VARCHAR(64) DEFAULT NULL,
  `reg_number` VARCHAR(64) DEFAULT NULL,
  `org_number` VARCHAR(64) DEFAULT NULL,
  `tax_number` VARCHAR(64) DEFAULT NULL,
  `reg_capital` VARCHAR(64) DEFAULT NULL,
  `actual_capital` VARCHAR(64) DEFAULT NULL,
  `company_org_type` VARCHAR(128) DEFAULT NULL,
  `establish_time` DATETIME DEFAULT NULL,
  `approved_time` DATETIME DEFAULT NULL,
  `from_time` DATETIME DEFAULT NULL,
  `to_time` DATETIME DEFAULT NULL,
  `reg_institute` VARCHAR(128) DEFAULT NULL,
  `reg_location` VARCHAR(255) DEFAULT NULL,
  `business_scope` LONGTEXT,
  `industry` VARCHAR(128) DEFAULT NULL,
  `category_code_first` VARCHAR(64) DEFAULT NULL,
  `category_code_second` VARCHAR(64) DEFAULT NULL,
  `category_code_third` VARCHAR(64) DEFAULT NULL,
  `category_code_fourth` VARCHAR(64) DEFAULT NULL,
  `province` VARCHAR(64) DEFAULT NULL,
  `city` VARCHAR(64) DEFAULT NULL,
  `district` VARCHAR(64) DEFAULT NULL,
  `base` VARCHAR(128) DEFAULT NULL,
  `phone_number` VARCHAR(64) DEFAULT NULL,
  `phone_list_json` LONGTEXT,
  `email` VARCHAR(128) DEFAULT NULL,
  `email_list_json` LONGTEXT,
  `website_list_json` LONGTEXT,
  `staff_num_range` VARCHAR(64) DEFAULT NULL,
  `social_staff_num` VARCHAR(32) DEFAULT NULL,
  `bond_name` VARCHAR(128) DEFAULT NULL,
  `bond_num` VARCHAR(64) DEFAULT NULL,
  `used_bond_name` VARCHAR(128) DEFAULT NULL,
  `stock_type` VARCHAR(64) DEFAULT NULL,
  `logo` VARCHAR(500) DEFAULT NULL,
  `tags_json` LONGTEXT,
  `is_micro_ent` TINYINT DEFAULT NULL,
  `percentile_score` VARCHAR(32) DEFAULT NULL,
  `brn_number` VARCHAR(64) DEFAULT NULL,
  `extra_json` LONGTEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_enterprise_basic_info_enterprise` (`enterprise_id`),
  KEY `idx_biz_enterprise_basic_info_tyc_enterprise` (`tyc_enterprise_id`),
  KEY `idx_biz_enterprise_basic_info_credit_code` (`credit_code`),
  KEY `idx_biz_enterprise_basic_info_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_enterprise_person` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `enterprise_id` BIGINT NOT NULL,
  `tyc_person_id` VARCHAR(64) DEFAULT NULL,
  `name` VARCHAR(64) NOT NULL,
  `position` VARCHAR(64) NOT NULL DEFAULT '',
  `person_type` VARCHAR(32) DEFAULT NULL,
  `is_legal_person` TINYINT NOT NULL DEFAULT 0,
  `phone` VARCHAR(32) DEFAULT NULL,
  `email` VARCHAR(128) DEFAULT NULL,
  `account_user_id` BIGINT DEFAULT NULL,
  `source` VARCHAR(64) DEFAULT NULL,
  `extra_json` LONGTEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_enterprise_person_enterprise_name_position` (`enterprise_id`, `name`, `position`),
  KEY `idx_biz_enterprise_person_tyc_person` (`tyc_person_id`),
  KEY `idx_biz_enterprise_person_account_user` (`account_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_tianyancha_api_call_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `api_code` VARCHAR(64) NOT NULL,
  `api_name` VARCHAR(128) NOT NULL,
  `api_url` VARCHAR(255) NOT NULL,
  `http_method` VARCHAR(16) NOT NULL,
  `request_keyword` VARCHAR(128) DEFAULT NULL,
  `request_params_json` LONGTEXT,
  `request_body_json` LONGTEXT,
  `request_headers_masked_json` LONGTEXT,
  `response_status` VARCHAR(32) NOT NULL,
  `http_status` INT DEFAULT NULL,
  `tyc_code` VARCHAR(64) DEFAULT NULL,
  `tyc_message` VARCHAR(255) DEFAULT NULL,
  `response_json` LONGTEXT,
  `response_hash` CHAR(64) DEFAULT NULL,
  `enterprise_id` BIGINT DEFAULT NULL,
  `tyc_enterprise_id` VARCHAR(64) DEFAULT NULL,
  `credit_code` VARCHAR(64) DEFAULT NULL,
  `company_name` VARCHAR(128) DEFAULT NULL,
  `duration_ms` INT DEFAULT NULL,
  `error_message` VARCHAR(500) DEFAULT NULL,
  `created_by` VARCHAR(64) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_tianyancha_api_call_log_api_code` (`api_code`),
  KEY `idx_biz_tianyancha_api_call_log_enterprise` (`enterprise_id`),
  KEY `idx_biz_tianyancha_api_call_log_tyc_enterprise` (`tyc_enterprise_id`),
  KEY `idx_biz_tianyancha_api_call_log_credit_code` (`credit_code`),
  KEY `idx_biz_tianyancha_api_call_log_company_name` (`company_name`),
  KEY `idx_biz_tianyancha_api_call_log_response_status` (`response_status`),
  KEY `idx_biz_tianyancha_api_call_log_created_at` (`created_at`),
  KEY `idx_biz_tianyancha_api_call_log_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_enterprise_owner` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `enterprise_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `remark` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_enterprise_owner_enterprise` (`enterprise_id`),
  UNIQUE KEY `uk_biz_enterprise_owner_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_enterprise_user` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `enterprise_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `is_default` TINYINT NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 1,
  `remark` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_enterprise_user_user` (`user_id`),
  KEY `idx_biz_enterprise_user_enterprise` (`enterprise_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_enterprise_teacher` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `enterprise_id` BIGINT NOT NULL,
  `teacher_user_id` BIGINT NOT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `remark` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_enterprise_teacher_enterprise` (`enterprise_id`),
  KEY `idx_biz_enterprise_teacher_user` (`teacher_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `sys_role` (`portal_type`, `code`, `name`, `remark`, `status`, `created_at`, `updated_at`)
SELECT 'admin', 'project_teacher', '项目老师', '负责政策解析、项目审核和材料检查', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_role` WHERE `portal_type` = 'admin' AND `code` = 'project_teacher');

INSERT INTO `sys_role` (`portal_type`, `code`, `name`, `remark`, `status`, `created_at`, `updated_at`)
SELECT 'client', 'enterprise_owner', '企业负责人', '企业端主账号，负责企业资料确认和申报提交', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_role` WHERE `portal_type` = 'client' AND `code` = 'enterprise_owner');

INSERT INTO `sys_role` (`portal_type`, `code`, `name`, `remark`, `status`, `created_at`, `updated_at`)
SELECT 'client', 'enterprise_user', '企业用户', '企业端普通账号，负责资料补充和协同操作', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_role` WHERE `portal_type` = 'client' AND `code` = 'enterprise_user');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Owner:List', '企业负责人列表', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Owner:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Owner:Create', '新增企业负责人', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Owner:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Owner:Edit', '编辑企业负责人', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Owner:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Owner:Delete', '删除企业负责人', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Owner:Delete');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:User:List', '企业用户列表', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:User:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:User:Create', '新增企业用户', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:User:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:User:Edit', '编辑企业用户', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:User:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:User:Delete', '删除企业用户', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:User:Delete');

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code IN (
  'Enterprise:Owner:List',
  'Enterprise:Owner:Create',
  'Enterprise:Owner:Edit',
  'Enterprise:Owner:Delete',
  'Enterprise:User:List',
  'Enterprise:User:Create',
  'Enterprise:User:Edit',
  'Enterprise:User:Delete'
)
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT id, 'enterprise-owner', 'owner', 'enterprise/owner/list', NULL, 'menu', NULL, 'system.enterprise.owner.name', 2, 1, 'Enterprise:Owner:List', NOW(), NOW()
FROM `sys_menu`
WHERE `path` = '/enterprise'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'enterprise-owner');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT id, 'enterprise-user', 'user', 'enterprise/user/list', NULL, 'menu', NULL, 'system.enterprise.user.name', 3, 1, 'Enterprise:User:List', NOW(), NOW()
FROM `sys_menu`
WHERE `path` = '/enterprise'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'enterprise-user');

-- CRM 合同、执行单同步基线：合同仅保存在同步记录中，不写入企业合同台账。
CREATE TABLE IF NOT EXISTS `biz_crm_contract_sync_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `source_request_id` VARCHAR(128) NOT NULL,
  `source_record_id` VARCHAR(128) DEFAULT NULL,
  `source_updated_at` DATETIME DEFAULT NULL,
  `source_version` VARCHAR(64) DEFAULT NULL,
  `event_type` VARCHAR(32) NOT NULL DEFAULT 'created',
  `sequence_no` VARCHAR(64) DEFAULT NULL,
  `contract_no` VARCHAR(128) DEFAULT NULL,
  `customer_contract_no` VARCHAR(128) DEFAULT NULL,
  `vendor_name` VARCHAR(128) DEFAULT NULL,
  `contract_name` VARCHAR(255) DEFAULT NULL,
  `account_manager_name` VARCHAR(64) DEFAULT NULL,
  `company_name` VARCHAR(255) NOT NULL,
  `enterprise_id` BIGINT DEFAULT NULL,
  `enterprise_name` VARCHAR(255) DEFAULT NULL,
  `import_result_json` LONGTEXT DEFAULT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `process_status` VARCHAR(32) NOT NULL DEFAULT 'received',
  `failure_reason` VARCHAR(1000) DEFAULT NULL,
  `retry_count` INT NOT NULL DEFAULT 0,
  `last_processed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_crm_contract_sync_source_request` (`source_request_id`),
  KEY `idx_biz_crm_contract_sync_source_record_id` (`source_record_id`),
  KEY `idx_biz_crm_contract_sync_contract_no` (`contract_no`),
  KEY `idx_biz_crm_contract_sync_source_updated_at` (`source_updated_at`),
  KEY `idx_biz_crm_contract_sync_event_type` (`event_type`),
  KEY `idx_biz_crm_contract_sync_company_name` (`company_name`),
  KEY `idx_biz_crm_contract_sync_enterprise_id` (`enterprise_id`),
  KEY `idx_biz_crm_contract_sync_status` (`process_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_crm_execution_order_sync_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `source_request_id` VARCHAR(128) NOT NULL,
  `source_record_id` VARCHAR(128) DEFAULT NULL,
  `source_updated_at` DATETIME DEFAULT NULL,
  `source_version` VARCHAR(64) DEFAULT NULL,
  `event_type` VARCHAR(32) NOT NULL DEFAULT 'created',
  `order_no` VARCHAR(128) NOT NULL,
  `company_name` VARCHAR(255) NOT NULL,
  `contract_no` VARCHAR(128) DEFAULT NULL,
  `contract_review_status` VARCHAR(64) DEFAULT NULL,
  `execution_order_name` VARCHAR(500) NOT NULL,
  `is_carried_forward` VARCHAR(32) DEFAULT NULL,
  `execution_department` VARCHAR(128) DEFAULT NULL,
  `account_manager_name` VARCHAR(64) DEFAULT NULL,
  `product_manager_name` VARCHAR(64) DEFAULT NULL,
  `enterprise_id` BIGINT DEFAULT NULL,
  `enterprise_name` VARCHAR(255) DEFAULT NULL,
  `recognized_project_codes` VARCHAR(255) DEFAULT NULL,
  `intellectual_property_count` INT DEFAULT NULL,
  `declaration_ids_json` LONGTEXT DEFAULT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `process_status` VARCHAR(32) NOT NULL DEFAULT 'received',
  `failure_reason` VARCHAR(1000) DEFAULT NULL,
  `retry_count` INT NOT NULL DEFAULT 0,
  `last_processed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_crm_execution_sync_source_request` (`source_request_id`),
  KEY `idx_biz_crm_execution_sync_source_record_id` (`source_record_id`),
  KEY `idx_biz_crm_execution_sync_order_no` (`order_no`),
  KEY `idx_biz_crm_execution_sync_company_name` (`company_name`),
  KEY `idx_biz_crm_execution_sync_contract_no` (`contract_no`),
  KEY `idx_biz_crm_execution_sync_source_updated_at` (`source_updated_at`),
  KEY `idx_biz_crm_execution_sync_event_type` (`event_type`),
  KEY `idx_biz_crm_execution_sync_enterprise_id` (`enterprise_id`),
  KEY `idx_biz_crm_execution_sync_status` (`process_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_crm_sync_attempt_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `record_type` VARCHAR(32) NOT NULL,
  `record_id` BIGINT NOT NULL,
  `attempt_type` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `operator_name` VARCHAR(64) DEFAULT NULL,
  `result_json` LONGTEXT DEFAULT NULL,
  `failure_reason` VARCHAR(1000) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_crm_sync_attempt_record` (`record_type`, `record_id`),
  KEY `idx_biz_crm_sync_attempt_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Crm:Sync:List', 'CRM同步记录查看', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Crm:Sync:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Crm:Sync:Retry', 'CRM同步重新执行', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Crm:Sync:Retry');

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT role.`id`, permission.`id`, NOW(), NOW()
FROM `sys_role` role
JOIN `sys_permission` permission ON permission.`code` IN ('Crm:Sync:List', 'Crm:Sync:Retry')
WHERE role.`code` IN ('admin', 'super_admin')
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_permission` existed
    WHERE existed.`role_id` = role.`id` AND existed.`permission_id` = permission.`id`
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT 'admin', NULL, 'CrmSync', '/crm-sync', NULL, '/crm-sync/contracts',
  'catalog', 'lucide:refresh-cw', 'CRM同步', 153, 1, 'Crm:Sync:List', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_menu` WHERE `portal_type` = 'admin' AND `name` = 'CrmSync'
);

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.`portal_type`, parent.`id`, 'CrmContractSyncRecord', 'contracts',
  'crm-sync/contract-records/index', NULL, 'menu', 'lucide:file-text', '合同同步记录',
  1, 1, 'Crm:Sync:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.`portal_type` = 'admin' AND parent.`name` = 'CrmSync'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `portal_type` = 'admin' AND `name` = 'CrmContractSyncRecord'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.`portal_type`, parent.`id`, 'CrmExecutionOrderSyncRecord', 'execution-orders',
  'crm-sync/execution-order-records/index', NULL, 'menu', 'lucide:clipboard-list', '执行单同步记录',
  2, 1, 'Crm:Sync:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.`portal_type` = 'admin' AND parent.`name` = 'CrmSync'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `portal_type` = 'admin' AND `name` = 'CrmExecutionOrderSyncRecord'
  );

-- CRM v2 安全集成基线：调用方、轮换密钥、一次性随机数、入站请求与异步任务。
CREATE TABLE IF NOT EXISTS `biz_crm_integration_client` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `app_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `allowed_ip_cidrs` VARCHAR(1000) DEFAULT NULL,
  `rate_limit_per_minute` INT NOT NULL DEFAULT 60,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_crm_integration_client_app_id` (`app_id`),
  KEY `idx_biz_crm_integration_client_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_crm_integration_key` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `client_id` BIGINT NOT NULL,
  `key_id` VARCHAR(64) NOT NULL,
  `secret_encrypted` LONGTEXT NOT NULL,
  `scopes` VARCHAR(255) NOT NULL DEFAULT 'contracts,execution_orders,status',
  `status` TINYINT NOT NULL DEFAULT 1,
  `expires_at` DATETIME DEFAULT NULL,
  `last_used_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_crm_integration_key_client_key` (`client_id`, `key_id`),
  KEY `idx_biz_crm_integration_key_client` (`client_id`),
  KEY `idx_biz_crm_integration_key_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_crm_integration_nonce` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `client_id` BIGINT NOT NULL,
  `nonce` VARCHAR(128) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_crm_integration_nonce_client_nonce` (`client_id`, `nonce`),
  KEY `idx_biz_crm_integration_nonce_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_crm_integration_inbound_request` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `client_id` BIGINT NOT NULL,
  `key_id` VARCHAR(64) NOT NULL,
  `request_type` VARCHAR(32) NOT NULL,
  `source_request_id` VARCHAR(128) NOT NULL,
  `source_request_hash` CHAR(64) NOT NULL,
  `body_hash` CHAR(64) NOT NULL,
  `request_json` LONGTEXT NOT NULL,
  `request_ip` VARCHAR(64) DEFAULT NULL,
  `process_status` VARCHAR(32) NOT NULL DEFAULT 'accepted',
  `failure_reason` VARCHAR(1000) DEFAULT NULL,
  `sync_record_type` VARCHAR(32) DEFAULT NULL,
  `sync_record_id` BIGINT DEFAULT NULL,
  `processed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_crm_integration_inbound_idempotency` (`client_id`, `request_type`, `source_request_hash`),
  KEY `idx_biz_crm_integration_inbound_status` (`process_status`),
  KEY `idx_biz_crm_integration_inbound_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_crm_integration_outbox_task` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `inbound_request_id` BIGINT NOT NULL,
  `request_type` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `attempt_count` INT NOT NULL DEFAULT 0,
  `available_at` DATETIME NOT NULL,
  `locked_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `last_error` VARCHAR(1000) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_crm_integration_outbox_inbound` (`inbound_request_id`),
  KEY `idx_biz_crm_integration_outbox_status_available` (`status`, `available_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Crm:Integration:Manage', 'CRM安全集成管理', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Crm:Integration:Manage');

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT role.`id`, permission.`id`, NOW(), NOW()
FROM `sys_role` role
JOIN `sys_permission` permission ON permission.`code` = 'Crm:Integration:Manage'
WHERE role.`code` IN ('admin', 'super_admin')
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_permission` existed
    WHERE existed.`role_id` = role.`id` AND existed.`permission_id` = permission.`id`
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.`portal_type`, parent.`id`, 'CrmIntegrationSecurity', 'security',
  'crm-sync/integration-security/index', NULL, 'menu', 'lucide:shield-check', '安全集成',
  3, 1, 'Crm:Integration:Manage', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.`portal_type` = 'admin' AND parent.`name` = 'CrmSync'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `portal_type` = 'admin' AND `name` = 'CrmIntegrationSecurity'
  );
