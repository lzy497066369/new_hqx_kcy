-- Client employee import P1: employee roster fields and material parse errors.

ALTER TABLE `biz_enterprise_employee_record`
  ADD COLUMN `id_card` VARCHAR(32) NULL AFTER `yg_nl`,
  ADD COLUMN `department` VARCHAR(128) NULL AFTER `id_card`,
  ADD COLUMN `position` VARCHAR(128) NULL AFTER `department`,
  ADD COLUMN `entry_date` VARCHAR(32) NULL AFTER `position`,
  ADD COLUMN `is_active` INT NULL AFTER `entry_date`,
  ADD COLUMN `rd_projects` VARCHAR(500) NULL AFTER `is_kjyf`,
  ADD COLUMN `annual_work_days` INT NULL AFTER `rd_projects`,
  ADD COLUMN `labor_contract_file` VARCHAR(500) NULL AFTER `yg_files`,
  ADD COLUMN `social_security_file` VARCHAR(500) NULL AFTER `labor_contract_file`,
  ADD COLUMN `education_file` VARCHAR(500) NULL AFTER `social_security_file`,
  ADD COLUMN `title_file` VARCHAR(500) NULL AFTER `education_file`,
  ADD KEY `idx_enterprise_employee_id_card` (`enterprise_id`, `id_card`);

CREATE TABLE IF NOT EXISTS `biz_enterprise_material_parse_error` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `enterprise_id` BIGINT NOT NULL,
  `material_id` BIGINT NOT NULL,
  `sheet_name` VARCHAR(64) NULL,
  `row_number` INT NULL,
  `field_name` VARCHAR(128) NULL,
  `raw_value` VARCHAR(500) NULL,
  `error_message` VARCHAR(255) NOT NULL,
  `suggestion` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_enterprise_material_parse_error_scope` (`enterprise_id`, `material_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
