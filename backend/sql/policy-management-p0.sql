-- P0 policy management backend schema and menu seed.
-- Compatible with MySQL 5.6.

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
  KEY `idx_biz_region_level` (`level`)
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

CREATE TABLE IF NOT EXISTS `biz_region_policy_file` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `region_id` BIGINT NOT NULL,
  `region_name` VARCHAR(64) NOT NULL,
  `project_id` BIGINT NOT NULL,
  `project_name` VARCHAR(128) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'incomplete',
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT DEFAULT NULL,
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

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AC_POLICY_ROOT', '政策管理', 'catalog', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AC_POLICY_ROOT');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:Region:List', '区域管理列表', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:Region:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:Region:Create', '新增区域', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:Region:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:Region:Edit', '修改区域', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:Region:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:Region:Delete', '删除区域', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:Region:Delete');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:Project:List', '统一政策项目列表', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:Project:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:Project:Create', '新增统一政策项目', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:Project:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:Project:Edit', '修改统一政策项目', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:Project:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:Project:Delete', '删除统一政策项目', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:Project:Delete');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:File:List', '区域政策文件列表', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:File:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:File:Create', '新增区域政策文件', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:File:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:File:Edit', '修改区域政策文件', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:File:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:File:Delete', '删除区域政策文件', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:File:Delete');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT NULL, 'Policy', '/policy', NULL, '/policy/regions', 'catalog', 'mdi:file-document-outline', '政策管理', 10, 1, 'AC_POLICY_ROOT', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'Policy');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'PolicyRegion', 'regions', 'policy/region/list', NULL, 'menu', NULL, '区域管理', 1, 1, 'Policy:Region:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'Policy'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'PolicyRegion');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'PolicyProject', 'projects', 'policy/project/list', NULL, 'menu', NULL, '统一政策项目', 2, 1, 'Policy:Project:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'Policy'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'PolicyProject');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'PolicyFile', 'files', 'policy/file/list', NULL, 'menu', NULL, '区域政策文件', 3, 1, 'Policy:File:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'Policy'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'PolicyFile');

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code = 'admin'
  AND p.code IN (
    'AC_POLICY_ROOT',
    'Policy:Region:List',
    'Policy:Region:Create',
    'Policy:Region:Edit',
    'Policy:Region:Delete',
    'Policy:Project:List',
    'Policy:Project:Create',
    'Policy:Project:Edit',
    'Policy:Project:Delete',
    'Policy:File:List',
    'Policy:File:Create',
    'Policy:File:Edit',
    'Policy:File:Delete'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
