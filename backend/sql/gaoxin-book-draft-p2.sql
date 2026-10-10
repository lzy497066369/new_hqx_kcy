-- Gaoxin declaration book draft P2.

CREATE TABLE IF NOT EXISTS `biz_gaoxin_book_draft` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `declaration_id` BIGINT NOT NULL,
  `enterprise_id` BIGINT NOT NULL,
  `project_id` BIGINT NOT NULL,
  `readonly_snapshot_json` LONGTEXT NULL,
  `supplemental_json` LONGTEXT NULL,
  `completion_rate` DECIMAL(6,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_gaoxin_book_draft_declaration` (`declaration_id`),
  KEY `idx_gaoxin_book_draft_scope` (`enterprise_id`, `project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
