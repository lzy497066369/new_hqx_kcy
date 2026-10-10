-- Application-scoped roles, permissions, menus, and user assignments.

CREATE TABLE IF NOT EXISTS iam_role (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  app_code VARCHAR(64) NOT NULL,
  role_code VARCHAR(64) NOT NULL,
  role_name VARCHAR(64) NOT NULL,
  role_type VARCHAR(32) NOT NULL DEFAULT 'custom',
  status TINYINT NOT NULL DEFAULT 1,
  remark VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_role_app_code (app_code, role_code),
  KEY idx_iam_role_app (app_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS iam_permission (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  app_code VARCHAR(64) NOT NULL,
  permission_code VARCHAR(128) NOT NULL,
  permission_name VARCHAR(128) NOT NULL,
  resource_type VARCHAR(32) NOT NULL DEFAULT 'api',
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_permission_app_code (app_code, permission_code),
  KEY idx_iam_permission_app (app_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS iam_role_permission (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_role_permission (role_id, permission_id),
  KEY idx_iam_role_permission_permission (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS iam_user_role (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  app_code VARCHAR(64) NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_user_role (user_id, app_code, role_id),
  KEY idx_iam_user_role_user_app (user_id, app_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS iam_menu (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  app_code VARCHAR(64) NOT NULL,
  parent_id BIGINT UNSIGNED NULL,
  menu_name VARCHAR(128) NOT NULL,
  menu_type VARCHAR(32) NOT NULL DEFAULT 'menu',
  path VARCHAR(255) NULL,
  component VARCHAR(255) NULL,
  redirect VARCHAR(255) NULL,
  auth_code VARCHAR(128) NULL,
  meta_json JSON NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_iam_menu_app_parent (app_code, parent_id),
  KEY idx_iam_menu_app_auth (app_code, auth_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
