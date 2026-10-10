-- Add client declaration display fields to region policy files.

SET @has_start_date := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'biz_region_policy_file'
    AND COLUMN_NAME = 'start_date'
);
SET @sql := IF(
  @has_start_date = 0,
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `start_date` DATE DEFAULT NULL AFTER `content`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_end_date := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'biz_region_policy_file'
    AND COLUMN_NAME = 'end_date'
);
SET @sql := IF(
  @has_end_date = 0,
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `end_date` DATE DEFAULT NULL AFTER `start_date`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_subsidy_amount_min := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'biz_region_policy_file'
    AND COLUMN_NAME = 'subsidy_amount_min'
);
SET @sql := IF(
  @has_subsidy_amount_min = 0,
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `subsidy_amount_min` DECIMAL(12,2) DEFAULT NULL AFTER `end_date`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_subsidy_amount_max := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'biz_region_policy_file'
    AND COLUMN_NAME = 'subsidy_amount_max'
);
SET @sql := IF(
  @has_subsidy_amount_max = 0,
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `subsidy_amount_max` DECIMAL(12,2) DEFAULT NULL AFTER `subsidy_amount_min`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_subsidy_text := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'biz_region_policy_file'
    AND COLUMN_NAME = 'subsidy_text'
);
SET @sql := IF(
  @has_subsidy_text = 0,
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `subsidy_text` VARCHAR(255) DEFAULT NULL AFTER `subsidy_amount_max`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_application_level := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'biz_region_policy_file'
    AND COLUMN_NAME = 'application_level'
);
SET @sql := IF(
  @has_application_level = 0,
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `application_level` VARCHAR(32) DEFAULT NULL AFTER `subsidy_text`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_condition_text := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'biz_region_policy_file'
    AND COLUMN_NAME = 'condition_text'
);
SET @sql := IF(
  @has_condition_text = 0,
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `condition_text` TEXT DEFAULT NULL AFTER `application_level`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_material_text := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'biz_region_policy_file'
    AND COLUMN_NAME = 'material_text'
);
SET @sql := IF(
  @has_material_text = 0,
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `material_text` TEXT DEFAULT NULL AFTER `condition_text`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_target_objects := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'biz_region_policy_file'
    AND COLUMN_NAME = 'target_objects'
);
SET @sql := IF(
  @has_target_objects = 0,
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `target_objects` VARCHAR(255) DEFAULT NULL AFTER `material_text`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
