CREATE TABLE IF NOT EXISTS iam_audit_event (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type VARCHAR(64) NOT NULL,
  action VARCHAR(128) NOT NULL,
  outcome VARCHAR(16) NOT NULL,
  actor_user_id VARCHAR(64) NULL,
  username VARCHAR(64) NULL,
  app_code VARCHAR(64) NULL,
  client_id VARCHAR(128) NULL,
  ip_address VARCHAR(64) NULL,
  details JSON NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_iam_audit_event_created (created_at),
  KEY idx_iam_audit_event_actor (actor_user_id),
  KEY idx_iam_audit_event_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
