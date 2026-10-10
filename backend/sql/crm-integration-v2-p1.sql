-- CRM v2：独立调用方、轮换密钥、签名防重放与异步入站任务。

CREATE TABLE IF NOT EXISTS `biz_crm_integration_client` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `app_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `allowed_ip_cidrs` VARCHAR(1000) DEFAULT NULL,
  `rate_limit_per_minute` INT NOT NULL DEFAULT 60,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_crm_integration_client_app_id` (`app_id`),
  KEY `idx_biz_crm_integration_client_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='CRM v2 调用方';

CREATE TABLE IF NOT EXISTS `biz_crm_integration_key` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `client_id` BIGINT NOT NULL,
  `key_id` VARCHAR(64) NOT NULL,
  `secret_encrypted` LONGTEXT NOT NULL,
  `scopes` VARCHAR(255) NOT NULL DEFAULT 'contracts,execution_orders,status',
  `status` TINYINT NOT NULL DEFAULT 1,
  `expires_at` DATETIME DEFAULT NULL,
  `last_used_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_crm_integration_key_client_key` (`client_id`, `key_id`),
  KEY `idx_biz_crm_integration_key_client` (`client_id`),
  KEY `idx_biz_crm_integration_key_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='CRM v2 HMAC 密钥密文';

CREATE TABLE IF NOT EXISTS `biz_crm_integration_nonce` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `client_id` BIGINT NOT NULL,
  `nonce` VARCHAR(128) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_crm_integration_nonce_client_nonce` (`client_id`, `nonce`),
  KEY `idx_biz_crm_integration_nonce_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='CRM v2 一次性随机数';

CREATE TABLE IF NOT EXISTS `biz_crm_integration_inbound_request` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `client_id` BIGINT NOT NULL,
  `key_id` VARCHAR(64) NOT NULL,
  `request_type` VARCHAR(32) NOT NULL,
  `source_request_id` VARCHAR(128) NOT NULL,
  `source_request_hash` CHAR(64) NOT NULL,
  `body_hash` CHAR(64) NOT NULL,
  `request_json` LONGTEXT NOT NULL,
  `request_ip` VARCHAR(64) DEFAULT NULL,
  `process_status` VARCHAR(32) NOT NULL DEFAULT 'accepted',
  `failure_reason` VARCHAR(1000) DEFAULT NULL,
  `sync_record_type` VARCHAR(32) DEFAULT NULL,
  `sync_record_id` BIGINT DEFAULT NULL,
  `processed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_crm_integration_inbound_idempotency` (`client_id`, `request_type`, `source_request_hash`),
  KEY `idx_biz_crm_integration_inbound_status` (`process_status`),
  KEY `idx_biz_crm_integration_inbound_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='CRM v2 已验签入站请求';

CREATE TABLE IF NOT EXISTS `biz_crm_integration_outbox_task` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `inbound_request_id` BIGINT NOT NULL,
  `request_type` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `attempt_count` INT NOT NULL DEFAULT 0,
  `available_at` DATETIME NOT NULL,
  `locked_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `last_error` VARCHAR(1000) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_crm_integration_outbox_inbound` (`inbound_request_id`),
  KEY `idx_biz_crm_integration_outbox_status_available` (`status`, `available_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='CRM v2 异步处理任务';

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Crm:Integration:Manage', 'CRM安全集成管理', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Crm:Integration:Manage');

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT role.`id`, permission.`id`, NOW(), NOW()
FROM `sys_role` role
JOIN `sys_permission` permission ON permission.`code` = 'Crm:Integration:Manage'
WHERE role.`code` IN ('admin', 'super_admin')
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_permission` existed
    WHERE existed.`role_id` = role.`id` AND existed.`permission_id` = permission.`id`
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.`portal_type`, parent.`id`, 'CrmIntegrationSecurity', 'security',
  'crm-sync/integration-security/index', NULL, 'menu', 'lucide:shield-check', '安全集成',
  3, 1, 'Crm:Integration:Manage', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.`portal_type` = 'admin' AND parent.`name` = 'CrmSync'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `portal_type` = 'admin' AND `name` = 'CrmIntegrationSecurity'
  );
