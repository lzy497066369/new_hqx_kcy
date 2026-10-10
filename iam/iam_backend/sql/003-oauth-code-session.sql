-- Preserve the SSO session that approved an authorization code.
SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'iam_oauth_authorization_code'
    AND column_name = 'session_id'
);
SET @migration_sql = IF(
  @column_exists = 0,
  'ALTER TABLE iam_oauth_authorization_code ADD COLUMN session_id VARCHAR(64) NOT NULL AFTER app_code, ADD KEY idx_iam_oauth_code_session (session_id)',
  'SELECT 1'
);
PREPARE iam_migration_statement FROM @migration_sql;
EXECUTE iam_migration_statement;
DEALLOCATE PREPARE iam_migration_statement;
