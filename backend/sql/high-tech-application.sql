-- 企业负责人高新技术企业三步申报草稿；上线前执行一次，可安全重复执行。
CREATE TABLE IF NOT EXISTS biz_high_tech_application (
  id BIGINT NOT NULL AUTO_INCREMENT,
  enterprise_id BIGINT NOT NULL,
  draft_json LONGTEXT NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_high_tech_application_enterprise (enterprise_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
