-- 企业资料 P2-P5：研发与知识产权、PS、成果转化、证据链和总览指标字段兜底脚本。
-- 说明：开发环境可由 TypeORM synchronize 自动补齐；生产/测试库可执行本脚本做手动迁移。

-- Enterprise profile P2-P5 fallback migration.
-- Covers RD/IP/PS/transformation fields, relation fields, and the client menu label.
-- Development can rely on TypeORM synchronize; staging/production can run this script manually.
DELIMITER $$

DROP PROCEDURE IF EXISTS add_enterprise_property_column_if_missing $$
CREATE PROCEDURE add_enterprise_property_column_if_missing(
  IN p_column_name VARCHAR(64),
  IN p_column_ddl TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'biz_enterprise_property_record'
      AND column_name = p_column_name
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `biz_enterprise_property_record` ADD COLUMN ', p_column_ddl);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

CALL add_enterprise_property_column_if_missing('ip_code', '`ip_code` VARCHAR(32) NULL AFTER `record_type`');
CALL add_enterprise_property_column_if_missing('ip_level', '`ip_level` VARCHAR(16) NULL AFTER `soft_work_file`');
CALL add_enterprise_property_column_if_missing('right_holder', '`right_holder` VARCHAR(255) NULL AFTER `ip_level`');
CALL add_enterprise_property_column_if_missing('is_core_ip', '`is_core_ip` TINYINT NULL AFTER `right_holder`');
CALL add_enterprise_property_column_if_missing('advanced_degree', '`advanced_degree` VARCHAR(255) NULL AFTER `is_core_ip`');
CALL add_enterprise_property_column_if_missing('support_effect', '`support_effect` VARCHAR(255) NULL AFTER `advanced_degree`');

CALL add_enterprise_property_column_if_missing('rd_budget', '`rd_budget` VARCHAR(64) NULL AFTER `ky_project_des`');
CALL add_enterprise_property_column_if_missing('rd_expense_total', '`rd_expense_total` VARCHAR(64) NULL AFTER `rd_budget`');
CALL add_enterprise_property_column_if_missing('rd_organization_method', '`rd_organization_method` TEXT NULL AFTER `rd_expense_total`');
CALL add_enterprise_property_column_if_missing('core_technology', '`core_technology` TEXT NULL AFTER `rd_organization_method`');
CALL add_enterprise_property_column_if_missing('innovation_points', '`innovation_points` TEXT NULL AFTER `core_technology`');
CALL add_enterprise_property_column_if_missing('stage_result', '`stage_result` TEXT NULL AFTER `innovation_points`');

CALL add_enterprise_property_column_if_missing('ps_code', '`ps_code` VARCHAR(64) NULL AFTER `stage_result`');
CALL add_enterprise_property_column_if_missing('ps_name', '`ps_name` VARCHAR(255) NULL AFTER `ps_code`');
CALL add_enterprise_property_column_if_missing('tech_field', '`tech_field` VARCHAR(255) NULL AFTER `ps_name`');
CALL add_enterprise_property_column_if_missing('tech_source', '`tech_source` VARCHAR(255) NULL AFTER `tech_field`');
CALL add_enterprise_property_column_if_missing('last_year_income', '`last_year_income` VARCHAR(64) NULL AFTER `tech_source`');
CALL add_enterprise_property_column_if_missing('high_tech_income', '`high_tech_income` VARCHAR(64) NULL AFTER `last_year_income`');
CALL add_enterprise_property_column_if_missing('tech_description', '`tech_description` TEXT NULL AFTER `high_tech_income`');
CALL add_enterprise_property_column_if_missing('tech_index', '`tech_index` TEXT NULL AFTER `tech_description`');
CALL add_enterprise_property_column_if_missing('competitive_advantage', '`competitive_advantage` TEXT NULL AFTER `tech_index`');

CALL add_enterprise_property_column_if_missing('transformation_code', '`transformation_code` VARCHAR(64) NULL AFTER `competitive_advantage`');
CALL add_enterprise_property_column_if_missing('transformation_name', '`transformation_name` VARCHAR(255) NULL AFTER `transformation_code`');
CALL add_enterprise_property_column_if_missing('transformation_year', '`transformation_year` VARCHAR(16) NULL AFTER `transformation_name`');
CALL add_enterprise_property_column_if_missing('transformation_method', '`transformation_method` VARCHAR(255) NULL AFTER `transformation_year`');
CALL add_enterprise_property_column_if_missing('transformation_income', '`transformation_income` VARCHAR(64) NULL AFTER `transformation_method`');
CALL add_enterprise_property_column_if_missing('customer_name', '`customer_name` VARCHAR(255) NULL AFTER `transformation_income`');
CALL add_enterprise_property_column_if_missing('application_scene', '`application_scene` TEXT NULL AFTER `customer_name`');
CALL add_enterprise_property_column_if_missing('proof_files', '`proof_files` TEXT NULL AFTER `application_scene`');

CALL add_enterprise_property_column_if_missing('related_rd_ids', '`related_rd_ids` TEXT NULL AFTER `proof_files`');
CALL add_enterprise_property_column_if_missing('related_ip_ids', '`related_ip_ids` TEXT NULL AFTER `related_rd_ids`');
CALL add_enterprise_property_column_if_missing('related_ps_ids', '`related_ps_ids` TEXT NULL AFTER `related_ip_ids`');
CALL add_enterprise_property_column_if_missing('related_transformation_ids', '`related_transformation_ids` TEXT NULL AFTER `related_ps_ids`');
CALL add_enterprise_property_column_if_missing('related_contract_ids', '`related_contract_ids` TEXT NULL AFTER `related_transformation_ids`');
CALL add_enterprise_property_column_if_missing('related_invoice_ids', '`related_invoice_ids` TEXT NULL AFTER `related_contract_ids`');

DROP PROCEDURE IF EXISTS add_enterprise_property_column_if_missing;

UPDATE `sys_menu`
SET
  `title` = CONVERT(UNHEX('E7A094E58F91E4B88EE79FA5E8AF86E4BAA7E69D83') USING utf8mb4),
  `component` = 'client/enterprise-profile/property/index',
  `updated_at` = NOW()
WHERE `name` = 'ClientCompanyProperty';
