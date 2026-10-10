-- Client enterprise profile statistics.
-- 企业资料模块只做通用统计，项目材料匹配放到申报项目侧处理。

CREATE TABLE IF NOT EXISTS `biz_enterprise_profile_stat` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `enterprise_id` BIGINT NOT NULL,
  `total_modules` INT NOT NULL DEFAULT 0,
  `completed_modules` INT NOT NULL DEFAULT 0,
  `total_records` INT NOT NULL DEFAULT 0,
  `attachment_records` INT NOT NULL DEFAULT 0,
  `missing_modules` LONGTEXT NULL,
  `completeness_rate` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `health_score` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `summary_json` LONGTEXT NULL,
  `calculated_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_enterprise_profile_stat_enterprise` (`enterprise_id`),
  KEY `idx_biz_enterprise_profile_stat_calculated` (`calculated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业资料通用统计主表';

CREATE TABLE IF NOT EXISTS `biz_enterprise_profile_stat_item` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `stat_id` BIGINT NOT NULL,
  `enterprise_id` BIGINT NOT NULL,
  `module_key` VARCHAR(64) NOT NULL,
  `tab_key` VARCHAR(64) NOT NULL,
  `module_name` VARCHAR(128) NOT NULL,
  `item_name` VARCHAR(128) NOT NULL,
  `record_count` INT NOT NULL DEFAULT 0,
  `attachment_count` INT NOT NULL DEFAULT 0,
  `required_min_count` INT NOT NULL DEFAULT 1,
  `is_completed` TINYINT NOT NULL DEFAULT 0,
  `missing_fields` LONGTEXT NULL,
  `score` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `summary` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_enterprise_profile_stat_item_scope` (`stat_id`, `module_key`, `tab_key`),
  KEY `idx_biz_enterprise_profile_stat_item_enterprise` (`enterprise_id`),
  KEY `idx_biz_enterprise_profile_stat_item_module` (`module_key`, `tab_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业资料通用统计明细表';
