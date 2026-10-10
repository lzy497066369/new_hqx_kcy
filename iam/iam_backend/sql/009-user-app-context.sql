-- Application-level user context. Keeps the active company separate from authorization rows.

CREATE TABLE IF NOT EXISTS iam_user_app_context (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  app_code VARCHAR(64) NOT NULL,
  default_company_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_user_app_context (user_id, app_code),
  KEY idx_iam_user_app_context_company (default_company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
