-- IAM owns the internal platform organization only. Company departments are not part of this product domain.

CREATE TABLE IF NOT EXISTS iam_platform_department (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_id BIGINT UNSIGNED NULL,
  dept_code VARCHAR(64) NOT NULL,
  dept_name VARCHAR(128) NOT NULL,
  leader_user_id BIGINT UNSIGNED NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  remark VARCHAR(255) NULL,
  source_system VARCHAR(64) NULL,
  source_department_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_platform_department_code (dept_code),
  UNIQUE KEY uk_iam_platform_department_source (source_system, source_department_id),
  KEY idx_iam_platform_department_parent (parent_id),
  KEY idx_iam_platform_department_leader (leader_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS iam_user_platform_department (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  is_primary TINYINT NOT NULL DEFAULT 1,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iam_user_platform_department (department_id, user_id),
  KEY idx_iam_user_platform_department_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- These tables were introduced for a company-department model that is not used by the current business domain.
DROP TABLE IF EXISTS iam_user_department;
DROP TABLE IF EXISTS iam_department;
