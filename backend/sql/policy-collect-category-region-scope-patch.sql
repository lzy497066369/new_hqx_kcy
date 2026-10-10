SET @@session.time_zone = '+08:00';
SET @db_name = DATABASE();

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'policy_collect_jobs' AND column_name = 'policy_category'),
  'SELECT 1',
  'ALTER TABLE `policy_collect_jobs` ADD COLUMN `policy_category` varchar(32) NOT NULL DEFAULT ''notice'' AFTER `official_domain_rules`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'policy_collect_jobs' AND column_name = 'region_scope'),
  'SELECT 1',
  'ALTER TABLE `policy_collect_jobs` ADD COLUMN `region_scope` varchar(16) NOT NULL DEFAULT ''district'' AFTER `region_name`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `policy_collect_jobs`
  MODIFY COLUMN `region_id` bigint DEFAULT NULL,
  MODIFY COLUMN `region_name` varchar(128) NOT NULL;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'policy_collect_run_items' AND column_name = 'policy_category'),
  'SELECT 1',
  'ALTER TABLE `policy_collect_run_items` ADD COLUMN `policy_category` varchar(32) NOT NULL DEFAULT ''notice'' AFTER `region_name`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `policy_collect_run_items`
  MODIFY COLUMN `region_id` bigint DEFAULT NULL,
  MODIFY COLUMN `region_name` varchar(128) NOT NULL;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'biz_region_policy_file' AND column_name = 'policy_category'),
  'SELECT 1',
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `policy_category` varchar(32) NOT NULL DEFAULT ''notice'' AFTER `project_name`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `biz_region_policy_file`
  MODIFY COLUMN `region_id` bigint DEFAULT NULL,
  MODIFY COLUMN `region_name` varchar(128) NOT NULL;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = @db_name AND table_name = 'policy_collect_jobs' AND index_name = 'idx_policy_collect_jobs_category'),
  'SELECT 1',
  'ALTER TABLE `policy_collect_jobs` ADD KEY `idx_policy_collect_jobs_category` (`policy_category`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = @db_name AND table_name = 'policy_collect_run_items' AND index_name = 'idx_policy_collect_items_category'),
  'SELECT 1',
  'ALTER TABLE `policy_collect_run_items` ADD KEY `idx_policy_collect_items_category` (`policy_category`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
