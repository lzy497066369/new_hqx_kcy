CREATE TABLE IF NOT EXISTS iam_admin_session (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash CHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  username VARCHAR(64) NOT NULL,
  real_name VARCHAR(64) NOT NULL,
  avatar_path VARCHAR(500) NULL,
  home_path VARCHAR(255) NOT NULL,
  roles JSON NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_admin_session_token_hash (token_hash),
  KEY idx_iam_admin_session_user (user_id),
  KEY idx_iam_admin_session_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
