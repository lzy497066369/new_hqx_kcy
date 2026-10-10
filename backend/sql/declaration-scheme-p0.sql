-- Configurable declaration scheme: qualification, material, scoring and workflow are released together.

CREATE TABLE IF NOT EXISTS `biz_declaration_scheme` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `project_id` BIGINT NOT NULL,
  `region_id` BIGINT DEFAULT NULL,
  `scheme_name` VARCHAR(128) NOT NULL,
  `version` VARCHAR(32) NOT NULL DEFAULT 'v1',
  `status` VARCHAR(16) NOT NULL DEFAULT 'draft',
  `effective_start_date` DATE DEFAULT NULL,
  `effective_end_date` DATE DEFAULT NULL,
  `qualification_rules_json` LONGTEXT DEFAULT NULL,
  `material_rules_json` LONGTEXT DEFAULT NULL,
  `score_rules_json` LONGTEXT DEFAULT NULL,
  `flow_template_json` LONGTEXT DEFAULT NULL,
  `capabilities_json` LONGTEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_declaration_scheme_project_status` (`project_id`, `status`),
  KEY `idx_biz_declaration_scheme_region_status` (`region_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `biz_client_declaration`
  ADD COLUMN `scheme_id` BIGINT DEFAULT NULL,
  ADD COLUMN `scheme_version` VARCHAR(32) DEFAULT NULL;

ALTER TABLE `biz_enterprise_certificate_record`
  ADD COLUMN `qualification_code` VARCHAR(64) DEFAULT NULL,
  ADD COLUMN `valid_until` DATE DEFAULT NULL;
