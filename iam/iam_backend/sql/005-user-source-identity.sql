-- Adds legacy/business identity mapping for existing IAM databases.

SET @iam_schema = DATABASE();

SET @iam_add_source_system = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = @iam_schema AND table_name = 'iam_user' AND column_name = 'source_system'
    ),
    'SELECT 1',
    'ALTER TABLE iam_user ADD COLUMN source_system VARCHAR(64) NULL AFTER remark'
  )
);
PREPARE iam_add_source_system_stmt FROM @iam_add_source_system;
EXECUTE iam_add_source_system_stmt;
DEALLOCATE PREPARE iam_add_source_system_stmt;

SET @iam_add_source_user_id = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = @iam_schema AND table_name = 'iam_user' AND column_name = 'source_user_id'
    ),
    'SELECT 1',
    'ALTER TABLE iam_user ADD COLUMN source_user_id VARCHAR(64) NULL AFTER source_system'
  )
);
PREPARE iam_add_source_user_id_stmt FROM @iam_add_source_user_id;
EXECUTE iam_add_source_user_id_stmt;
DEALLOCATE PREPARE iam_add_source_user_id_stmt;

SET @iam_add_source_index = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = @iam_schema AND table_name = 'iam_user' AND index_name = 'idx_iam_user_source'
    ),
    'SELECT 1',
    'ALTER TABLE iam_user ADD KEY idx_iam_user_source (source_system, source_user_id)'
  )
);
PREPARE iam_add_source_index_stmt FROM @iam_add_source_index;
EXECUTE iam_add_source_index_stmt;
DEALLOCATE PREPARE iam_add_source_index_stmt;
