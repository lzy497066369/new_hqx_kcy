SET @@session.time_zone = '+08:00';
SET @db_name = DATABASE();

CREATE TABLE IF NOT EXISTS `policy_collect_jobs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL,
  `project_id` bigint NOT NULL,
  `project_name` varchar(128) NOT NULL,
  `region_id` bigint DEFAULT NULL,
  `region_name` varchar(128) NOT NULL,
  `region_scope` varchar(16) NOT NULL DEFAULT 'district',
  `keywords` varchar(500) DEFAULT NULL,
  `department_name` varchar(128) DEFAULT NULL,
  `official_domain_rules` text DEFAULT NULL,
  `policy_category` varchar(32) NOT NULL DEFAULT 'notice',
  `cron_expression` varchar(64) DEFAULT NULL,
  `enabled` tinyint NOT NULL DEFAULT 0,
  `last_run_at` datetime DEFAULT NULL,
  `next_run_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `owner_user_id` bigint DEFAULT NULL,
  `owner_name` varchar(64) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_policy_collect_jobs_project` (`project_id`),
  KEY `idx_policy_collect_jobs_region` (`region_id`),
  KEY `idx_policy_collect_jobs_owner` (`owner_user_id`),
  KEY `idx_policy_collect_jobs_category` (`policy_category`),
  KEY `idx_policy_collect_jobs_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `policy_collect_runs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `job_id` bigint NOT NULL,
  `job_name` varchar(128) NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'pending',
  `current_step` varchar(64) DEFAULT NULL,
  `progress` int NOT NULL DEFAULT 0,
  `step_message` varchar(255) DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `searched_keywords` text DEFAULT NULL,
  `total_count` int NOT NULL DEFAULT 0,
  `new_count` int NOT NULL DEFAULT 0,
  `changed_count` int NOT NULL DEFAULT 0,
  `same_count` int NOT NULL DEFAULT 0,
  `uncertain_count` int NOT NULL DEFAULT 0,
  `ignored_count` int NOT NULL DEFAULT 0,
  `error_message` text DEFAULT NULL,
  `ai_task_id` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_policy_collect_runs_job` (`job_id`),
  KEY `idx_policy_collect_runs_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'policy_collect_runs' AND column_name = 'current_step'),
  'SELECT 1',
  'ALTER TABLE `policy_collect_runs` ADD COLUMN `current_step` varchar(64) DEFAULT NULL AFTER `status`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'policy_collect_runs' AND column_name = 'progress'),
  'SELECT 1',
  'ALTER TABLE `policy_collect_runs` ADD COLUMN `progress` int NOT NULL DEFAULT 0 AFTER `current_step`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'policy_collect_runs' AND column_name = 'step_message'),
  'SELECT 1',
  'ALTER TABLE `policy_collect_runs` ADD COLUMN `step_message` varchar(255) DEFAULT NULL AFTER `progress`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `policy_collect_run_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `run_id` bigint NOT NULL,
  `job_id` bigint NOT NULL,
  `project_id` bigint NOT NULL,
  `project_name` varchar(128) NOT NULL,
  `region_id` bigint DEFAULT NULL,
  `region_name` varchar(128) NOT NULL,
  `policy_category` varchar(32) NOT NULL DEFAULT 'notice',
  `title` varchar(255) NOT NULL,
  `official_url` varchar(500) DEFAULT NULL,
  `issuing_agency` varchar(128) DEFAULT NULL,
  `document_no` varchar(128) DEFAULT NULL,
  `publish_date` date DEFAULT NULL,
  `summary` text DEFAULT NULL,
  `raw_text` longtext DEFAULT NULL,
  `structured_result` longtext DEFAULT NULL,
  `content_hash` varchar(64) DEFAULT NULL,
  `attachment_url` varchar(500) DEFAULT NULL,
  `attachment_hash` varchar(64) DEFAULT NULL,
  `official_verified` tinyint NOT NULL DEFAULT 0,
  `official_confidence` varchar(16) DEFAULT NULL,
  `compare_status` varchar(32) NOT NULL,
  `matched_policy_file_id` bigint DEFAULT NULL,
  `ai_reason` text DEFAULT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'pending_review',
  `ai_task_id` bigint DEFAULT NULL,
  `reviewed_by` bigint DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_policy_collect_items_run` (`run_id`),
  KEY `idx_policy_collect_items_job` (`job_id`),
  KEY `idx_policy_collect_items_project` (`project_id`),
  KEY `idx_policy_collect_items_region` (`region_id`),
  KEY `idx_policy_collect_items_category` (`policy_category`),
  KEY `idx_policy_collect_items_compare` (`compare_status`),
  KEY `idx_policy_collect_items_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `policy_collect_notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `job_id` bigint DEFAULT NULL,
  `run_id` bigint DEFAULT NULL,
  `run_item_id` bigint DEFAULT NULL,
  `type` varchar(32) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text DEFAULT NULL,
  `target_user_id` bigint DEFAULT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'unread',
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_policy_collect_notify_user` (`target_user_id`),
  KEY `idx_policy_collect_notify_status` (`status`),
  KEY `idx_policy_collect_notify_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @db_name = DATABASE();

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'biz_region_policy_file' AND column_name = 'source_run_item_id'),
  'SELECT 1',
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `source_run_item_id` bigint DEFAULT NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'biz_region_policy_file' AND column_name = 'official_source_name'),
  'SELECT 1',
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `official_source_name` varchar(128) DEFAULT NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'biz_region_policy_file' AND column_name = 'official_publish_date'),
  'SELECT 1',
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `official_publish_date` date DEFAULT NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'biz_region_policy_file' AND column_name = 'document_no'),
  'SELECT 1',
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `document_no` varchar(128) DEFAULT NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'biz_region_policy_file' AND column_name = 'issuing_agency'),
  'SELECT 1',
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `issuing_agency` varchar(128) DEFAULT NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'biz_region_policy_file' AND column_name = 'source_hash'),
  'SELECT 1',
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `source_hash` varchar(64) DEFAULT NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'biz_region_policy_file' AND column_name = 'imported_by_ai'),
  'SELECT 1',
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `imported_by_ai` tinyint NOT NULL DEFAULT 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'biz_region_policy_file' AND column_name = 'ai_confidence'),
  'SELECT 1',
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `ai_confidence` varchar(16) DEFAULT NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:CollectJob:List', '政策采集任务列表', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:CollectJob:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:CollectRun:List', '政策采集结果列表', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:CollectRun:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:CollectReview:List', '政策待审查列表', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:CollectReview:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Policy:CollectWorkbench:View', '工作台政策采集提醒', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Policy:CollectWorkbench:View');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'PolicyCollectJob', 'collect-jobs', 'policy/collect/job-list', NULL, 'menu', 'lucide:radar', '政策采集任务', 4, 1, 'Policy:CollectJob:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name IN ('Policy', 'PolicyManagement')
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'PolicyCollectJob')
LIMIT 1;

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'PolicyCollectRun', 'collect-runs', 'policy/collect/run-list', NULL, 'menu', 'lucide:history', '政策采集结果', 5, 1, 'Policy:CollectRun:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name IN ('Policy', 'PolicyManagement')
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'PolicyCollectRun')
LIMIT 1;

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'PolicyCollectReview', 'collect-review', 'policy/collect/review-list', NULL, 'menu', 'lucide:clipboard-check', '政策待审查', 6, 1, 'Policy:CollectReview:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name IN ('Policy', 'PolicyManagement')
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'PolicyCollectReview')
LIMIT 1;

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code = 'admin'
  AND p.code IN (
    'Policy:CollectJob:List',
    'Policy:CollectRun:List',
    'Policy:CollectReview:List',
    'Policy:CollectWorkbench:View'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
