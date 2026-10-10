-- Project material readiness P1: material requirements and material check closure.

CREATE TABLE IF NOT EXISTS `biz_project_material_requirement` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `project_id` BIGINT NOT NULL,
  `requirement_name` VARCHAR(128) NOT NULL,
  `description` VARCHAR(500) DEFAULT NULL,
  `version` VARCHAR(32) NOT NULL DEFAULT 'v1',
  `enabled` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_project_material_requirement_project` (`project_id`),
  KEY `idx_biz_project_material_requirement_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_project_material_requirement_item` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `requirement_id` BIGINT NOT NULL,
  `module_key` VARCHAR(64) NOT NULL,
  `tab_key` VARCHAR(64) NOT NULL,
  `item_name` VARCHAR(128) NOT NULL,
  `requirement_desc` VARCHAR(500) DEFAULT NULL,
  `required_count` INT NOT NULL DEFAULT 1,
  `required_years` LONGTEXT DEFAULT NULL,
  `required_fields` LONGTEXT DEFAULT NULL,
  `attachment_required` TINYINT NOT NULL DEFAULT 0,
  `is_required` TINYINT NOT NULL DEFAULT 1,
  `score_weight` DECIMAL(8,2) NOT NULL DEFAULT 1.00,
  `sort_order` INT NOT NULL DEFAULT 0,
  `enabled` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_project_material_requirement_item_requirement` (`requirement_id`),
  KEY `idx_biz_project_material_requirement_item_module` (`module_key`, `tab_key`),
  KEY `idx_biz_project_material_requirement_item_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_declaration_material_check` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `enterprise_id` BIGINT NOT NULL,
  `project_id` BIGINT NOT NULL,
  `declaration_id` BIGINT DEFAULT NULL,
  `requirement_id` BIGINT NOT NULL,
  `check_status` VARCHAR(32) NOT NULL DEFAULT 'missing',
  `total_items` INT NOT NULL DEFAULT 0,
  `passed_items` INT NOT NULL DEFAULT 0,
  `missing_items` INT NOT NULL DEFAULT 0,
  `readiness_score` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `risk_level` VARCHAR(32) NOT NULL DEFAULT 'high',
  `summary_json` LONGTEXT DEFAULT NULL,
  `checked_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_declaration_material_check_enterprise` (`enterprise_id`),
  KEY `idx_biz_declaration_material_check_project` (`project_id`),
  KEY `idx_biz_declaration_material_check_declaration` (`declaration_id`),
  KEY `idx_biz_declaration_material_check_requirement` (`requirement_id`),
  KEY `idx_biz_declaration_material_check_checked_at` (`checked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_declaration_material_check_item` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `check_id` BIGINT NOT NULL,
  `requirement_item_id` BIGINT DEFAULT NULL,
  `module_key` VARCHAR(64) NOT NULL,
  `tab_key` VARCHAR(64) NOT NULL,
  `item_name` VARCHAR(128) NOT NULL,
  `required_count` INT NOT NULL DEFAULT 1,
  `matched_count` INT NOT NULL DEFAULT 0,
  `matched_record_ids` LONGTEXT DEFAULT NULL,
  `missing_fields` LONGTEXT DEFAULT NULL,
  `attachment_missing` TINYINT NOT NULL DEFAULT 0,
  `check_status` VARCHAR(32) NOT NULL DEFAULT 'missing',
  `suggestion` VARCHAR(500) DEFAULT NULL,
  `score` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_declaration_material_check_item_check` (`check_id`),
  KEY `idx_biz_declaration_material_check_item_requirement` (`requirement_item_id`),
  KEY `idx_biz_declaration_material_check_item_module` (`module_key`, `tab_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
