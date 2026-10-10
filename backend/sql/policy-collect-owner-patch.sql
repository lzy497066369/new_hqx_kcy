SET @@session.time_zone = '+08:00';
SET @db_name = DATABASE();

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'policy_collect_jobs' AND column_name = 'owner_user_id'),
  'SELECT 1',
  'ALTER TABLE `policy_collect_jobs` ADD COLUMN `owner_user_id` bigint DEFAULT NULL AFTER `created_by`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'policy_collect_jobs' AND column_name = 'owner_name'),
  'SELECT 1',
  'ALTER TABLE `policy_collect_jobs` ADD COLUMN `owner_name` varchar(64) DEFAULT NULL AFTER `owner_user_id`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = @db_name AND table_name = 'policy_collect_jobs' AND index_name = 'idx_policy_collect_jobs_owner'),
  'SELECT 1',
  'ALTER TABLE `policy_collect_jobs` ADD KEY `idx_policy_collect_jobs_owner` (`owner_user_id`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
