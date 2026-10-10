-- 企业知识产权增加技术领域分类字段。

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

CALL add_enterprise_property_column_if_missing(
  'ip_tech_category',
  '`ip_tech_category` VARCHAR(64) NULL AFTER `support_effect`'
);

DROP PROCEDURE IF EXISTS add_enterprise_property_column_if_missing;
