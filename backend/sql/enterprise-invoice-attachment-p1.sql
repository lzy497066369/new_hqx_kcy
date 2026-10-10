SET @db_name = DATABASE();
SET @has_fp_path = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db_name
    AND table_name = 'biz_enterprise_contract_record'
    AND column_name = 'fp_path'
);
SET @sql = IF(
  @has_fp_path = 0,
  'ALTER TABLE `biz_enterprise_contract_record` ADD COLUMN `fp_path` VARCHAR(500) NULL AFTER `remark`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
