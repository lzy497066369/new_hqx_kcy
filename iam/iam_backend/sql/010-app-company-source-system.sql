-- Limits all-company access to the company source domain configured for an application.

SET @iam_app_company_source_system_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'iam_app' AND column_name = 'company_source_system'
);
SET @iam_app_company_source_system_sql := IF(
  @iam_app_company_source_system_exists = 0,
  'ALTER TABLE iam_app ADD COLUMN company_source_system VARCHAR(64) NULL AFTER portal_type',
  'SELECT 1'
);
PREPARE iam_app_company_source_system_statement FROM @iam_app_company_source_system_sql;
EXECUTE iam_app_company_source_system_statement;
DEALLOCATE PREPARE iam_app_company_source_system_statement;
