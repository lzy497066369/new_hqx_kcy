CREATE TABLE IF NOT EXISTS `biz_client_user_profile` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `current_enterprise_id` BIGINT DEFAULT NULL,
  `position` VARCHAR(64) DEFAULT NULL,
  `role_name` VARCHAR(64) DEFAULT NULL,
  `remark` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_client_user_profile_user` (`user_id`),
  KEY `idx_biz_client_user_profile_enterprise` (`current_enterprise_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_enterprise_contact` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `enterprise_id` BIGINT NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `phone` VARCHAR(32) DEFAULT NULL,
  `email` VARCHAR(128) DEFAULT NULL,
  `position` VARCHAR(64) DEFAULT NULL,
  `role_name` VARCHAR(64) DEFAULT NULL,
  `is_default` TINYINT NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 1,
  `remark` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_enterprise_contact_enterprise` (`enterprise_id`),
  KEY `idx_biz_enterprise_contact_default` (`enterprise_id`, `is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `biz_enterprise_material` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `enterprise_id` BIGINT NOT NULL,
  `template_id` VARCHAR(64) DEFAULT NULL,
  `template_name` VARCHAR(128) DEFAULT NULL,
  `material_type` VARCHAR(64) DEFAULT NULL,
  `file_name` VARCHAR(255) DEFAULT NULL,
  `file_path` VARCHAR(500) DEFAULT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'uploaded',
  `error_count` INT NOT NULL DEFAULT 0,
  `remark` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_enterprise_material_enterprise` (`enterprise_id`),
  KEY `idx_biz_enterprise_material_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
