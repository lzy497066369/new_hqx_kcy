-- 企业项目多选以 JSON 数组存放于 TEXT；兼容 MySQL 5.6，旧档案保持 NULL。
SET @projects_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_enterprise' AND COLUMN_NAME = 'enterprise_projects');
SET @sql = IF(@projects_column_exists = 0, 'ALTER TABLE biz_enterprise ADD COLUMN enterprise_projects TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
