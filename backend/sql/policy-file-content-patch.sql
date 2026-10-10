SET @has_policy_file_content := (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'biz_region_policy_file'
    AND COLUMN_NAME = 'content'
);

SET @policy_file_content_sql := IF(
  @has_policy_file_content = 0,
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `content` TEXT DEFAULT NULL AFTER `title`',
  'SELECT 1'
);

PREPARE policy_file_content_stmt FROM @policy_file_content_sql;
EXECUTE policy_file_content_stmt;
DEALLOCATE PREPARE policy_file_content_stmt;

SET @has_policy_official_file_url := (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'biz_region_policy_file'
    AND COLUMN_NAME = 'official_file_url'
);

SET @policy_official_file_url_sql := IF(
  @has_policy_official_file_url = 0,
  'ALTER TABLE `biz_region_policy_file` ADD COLUMN `official_file_url` VARCHAR(500) DEFAULT NULL AFTER `content`',
  'SELECT 1'
);

PREPARE policy_official_file_url_stmt FROM @policy_official_file_url_sql;
EXECUTE policy_official_file_url_stmt;
DEALLOCATE PREPARE policy_official_file_url_stmt;
