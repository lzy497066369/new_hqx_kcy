-- Client declaration P0: declaration draft main table.

CREATE TABLE IF NOT EXISTS `biz_client_declaration` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `declaration_no` VARCHAR(64) NOT NULL,
  `enterprise_id` BIGINT NOT NULL,
  `enterprise_name` VARCHAR(128) NOT NULL,
  `project_id` BIGINT NOT NULL,
  `project_name` VARCHAR(128) NOT NULL,
  `policy_type` VARCHAR(128) DEFAULT NULL,
  `policy_file_ids` VARCHAR(500) DEFAULT NULL,
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
  KEY `idx_biz_client_declaration_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
