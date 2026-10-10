-- 研发与知识产权 P1：AI 草稿表。
-- 用于保存知识产权 PDF 识别、成果/RD/PS 生成等人工审核前的结构化草稿。

CREATE TABLE IF NOT EXISTS `ai_drafts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `enterprise_id` bigint NOT NULL,
  `task_id` bigint NULL,
  `draft_type` varchar(64) NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'reviewing',
  `source_ids` text NULL,
  `draft_payload` longtext NULL,
  `approved_record_id` bigint NULL,
  `reviewed_by` bigint NULL,
  `reviewed_at` datetime NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_drafts_enterprise_type_status` (`enterprise_id`, `draft_type`, `status`),
  KEY `idx_ai_drafts_task_id` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
