-- IAM M1 persistence baseline. Compatible with MySQL 5.6 and newer.

CREATE TABLE IF NOT EXISTS iam_app (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  app_code VARCHAR(64) NOT NULL,
  app_name VARCHAR(128) NOT NULL,
  app_type VARCHAR(32) NOT NULL DEFAULT 'web',
  portal_type VARCHAR(32) NOT NULL DEFAULT 'admin',
  company_source_system VARCHAR(64) NULL,
  home_path VARCHAR(255) NULL,
  status TINYINT NOT NULL DEFAULT 1,
  remark VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_app_code (app_code),
  KEY idx_iam_app_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS iam_user (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  real_name VARCHAR(64) NOT NULL,
  phone VARCHAR(32) NULL,
  email VARCHAR(128) NULL,
  avatar_path VARCHAR(500) NULL,
  status TINYINT NOT NULL DEFAULT 1,
  password_changed_at DATETIME NULL,
  last_login_at DATETIME NULL,
  remark VARCHAR(255) NULL,
  source_system VARCHAR(64) NULL,
  source_user_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_user_username (username),
  UNIQUE KEY uk_iam_user_phone (phone),
  UNIQUE KEY uk_iam_user_email (email),
  KEY idx_iam_user_source (source_system, source_user_id),
  KEY idx_iam_user_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS iam_company (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_name VARCHAR(128) NOT NULL,
  short_name VARCHAR(128) NULL,
  credit_code VARCHAR(64) NULL,
  legal_person VARCHAR(64) NULL,
  contact_name VARCHAR(64) NULL,
  contact_phone VARCHAR(32) NULL,
  province VARCHAR(64) NULL,
  city VARCHAR(64) NULL,
  district VARCHAR(64) NULL,
  status TINYINT NOT NULL DEFAULT 1,
  source_system VARCHAR(64) NULL,
  source_company_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_company_credit_code (credit_code),
  KEY idx_iam_company_name (company_name),
  KEY idx_iam_company_source (source_system, source_company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS iam_company_member (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  app_code VARCHAR(64) NOT NULL,
  member_type VARCHAR(32) NOT NULL,
  is_primary TINYINT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_company_member (company_id, user_id, app_code, member_type),
  KEY idx_iam_company_member_user_app (user_id, app_code),
  KEY idx_iam_company_member_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS iam_user_company_scope (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  app_code VARCHAR(64) NOT NULL,
  company_id BIGINT UNSIGNED NOT NULL,
  relation_type VARCHAR(32) NOT NULL,
  data_scope VARCHAR(32) NOT NULL DEFAULT 'assigned',
  is_default TINYINT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_user_company_scope (user_id, app_code, company_id, relation_type),
  KEY idx_iam_user_company_scope_user_app (user_id, app_code),
  KEY idx_iam_user_company_scope_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
