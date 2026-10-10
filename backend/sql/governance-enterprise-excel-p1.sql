-- 企业预申报年份。历史档案保持 NULL，新建/Excel 导入由应用强制五字段必填。
-- 可重复执行；兼容 MySQL 5.6。
SET @year_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_enterprise' AND COLUMN_NAME = 'pre_declaration_year');
SET @sql = IF(@year_column_exists = 0, 'ALTER TABLE biz_enterprise ADD COLUMN pre_declaration_year SMALLINT NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
