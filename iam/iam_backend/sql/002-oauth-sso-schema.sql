-- OAuth2 Authorization Code + PKCE and SSO session persistence.

CREATE TABLE IF NOT EXISTS iam_user_app (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  app_code VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  home_path VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_user_app (user_id, app_code),
  KEY idx_iam_user_app_code (app_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS iam_oauth_client (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  app_code VARCHAR(64) NOT NULL,
  client_id VARCHAR(128) NOT NULL,
  client_secret_hash VARCHAR(255) NULL,
  client_type VARCHAR(32) NOT NULL DEFAULT 'public',
  grant_types JSON NOT NULL,
  redirect_uris JSON NOT NULL,
  post_logout_redirect_uris JSON NULL,
  access_token_ttl INT NOT NULL DEFAULT 1800,
  refresh_token_ttl INT NOT NULL DEFAULT 2592000,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_oauth_client_id (client_id),
  KEY idx_iam_oauth_client_app (app_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS iam_oauth_authorization_code (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code_hash CHAR(64) NOT NULL,
  client_id VARCHAR(128) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  app_code VARCHAR(64) NOT NULL,
  redirect_uri VARCHAR(500) NOT NULL,
  scope VARCHAR(500) NULL,
  code_challenge VARCHAR(128) NOT NULL,
  code_challenge_method VARCHAR(16) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_oauth_code_hash (code_hash),
  KEY idx_iam_oauth_code_client (client_id),
  KEY idx_iam_oauth_code_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS iam_sso_session (
  id VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  login_ip VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_iam_sso_session_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS iam_refresh_token (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash CHAR(64) NOT NULL,
  client_id VARCHAR(128) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  app_code VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  rotated_from_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_refresh_token_hash (token_hash),
  KEY idx_iam_refresh_user_app (user_id, app_code),
  KEY idx_iam_refresh_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
