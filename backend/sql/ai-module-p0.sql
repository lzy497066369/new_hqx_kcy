CREATE TABLE IF NOT EXISTS `ai_tasks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `scene` varchar(64) NOT NULL,
  `biz_type` varchar(64) NOT NULL,
  `biz_id` varchar(64) NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'pending',
  `input_snapshot` longtext NULL,
  `result_id` bigint NULL,
  `error_message` text NULL,
  `created_by` bigint NULL,
  `finished_at` datetime NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_tasks_scene` (`scene`),
  KEY `idx_ai_tasks_biz` (`biz_type`, `biz_id`),
  KEY `idx_ai_tasks_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ai_results` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `task_id` bigint NOT NULL,
  `scene` varchar(64) NOT NULL,
  `summary` text NULL,
  `structured_result` longtext NULL,
  `confidence` varchar(32) NULL,
  `status` varchar(32) NOT NULL DEFAULT 'draft',
  `confirmed_by` bigint NULL,
  `confirmed_at` datetime NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_results_task_id` (`task_id`),
  KEY `idx_ai_results_scene` (`scene`),
  KEY `idx_ai_results_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ai_audit_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `task_id` bigint NOT NULL,
  `provider` varchar(64) NOT NULL,
  `model` varchar(128) NOT NULL,
  `prompt` longtext NOT NULL,
  `raw_response` longtext NULL,
  `token_usage` text NULL,
  `duration_ms` int NULL,
  `error_message` text NULL,
  `cost` decimal(12,6) NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_audit_logs_task_id` (`task_id`),
  KEY `idx_ai_audit_logs_provider` (`provider`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
