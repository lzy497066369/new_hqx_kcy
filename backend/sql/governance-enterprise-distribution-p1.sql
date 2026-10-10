-- 管理端三字段建档：区域与销售负责人独立于分发关系保存。
-- 可重复执行；信用代码在企业负责人补齐资料时录入，NULL 不占用唯一索引。
SET @region_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_enterprise' AND COLUMN_NAME = 'region_id');
SET @sql = IF(@region_column_exists = 0, 'ALTER TABLE biz_enterprise ADD COLUMN region_id BIGINT NULL, ADD INDEX idx_biz_enterprise_region (region_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @sales_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_enterprise' AND COLUMN_NAME = 'sales_owner');
SET @sql = IF(@sales_column_exists = 0, 'ALTER TABLE biz_enterprise ADD COLUMN sales_owner VARCHAR(64) NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
ALTER TABLE biz_enterprise MODIFY COLUMN credit_code VARCHAR(64) NULL;

-- 只补齐历史企业的区域，保留现有负责人绑定及所有业务资料。
UPDATE biz_enterprise e
JOIN biz_enterprise_teacher t ON t.enterprise_id = e.id AND t.status = 1
JOIN biz_region_project_user r ON r.user_id = t.teacher_user_id AND r.status = 1
SET e.region_id = r.region_id
WHERE e.region_id IS NULL;
