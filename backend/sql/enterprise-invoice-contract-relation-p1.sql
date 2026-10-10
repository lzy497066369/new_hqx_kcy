SET @db_name = DATABASE();
SET @has_ht_id = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db_name
    AND table_name = 'biz_enterprise_contract_record'
    AND column_name = 'ht_id'
);
SET @sql = IF(
  @has_ht_id = 0,
  'ALTER TABLE `biz_enterprise_contract_record` ADD COLUMN `ht_id` BIGINT NULL AFTER `fp_num`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
