-- CRM 合同、执行单同步：仅保存 CRM 同步记录；不写入企业合同台账。

CREATE TABLE IF NOT EXISTS `biz_crm_contract_sync_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `source_request_id` VARCHAR(128) NOT NULL,
  `sequence_no` VARCHAR(64) DEFAULT NULL,
  `contract_no` VARCHAR(128) DEFAULT NULL,
  `customer_contract_no` VARCHAR(128) DEFAULT NULL,
  `vendor_name` VARCHAR(128) DEFAULT NULL,
  `contract_name` VARCHAR(255) DEFAULT NULL,
  `account_manager_name` VARCHAR(64) DEFAULT NULL,
  `company_name` VARCHAR(255) NOT NULL,
  `enterprise_id` BIGINT DEFAULT NULL,
  `enterprise_name` VARCHAR(255) DEFAULT NULL,
  `import_result_json` LONGTEXT DEFAULT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `process_status` VARCHAR(32) NOT NULL DEFAULT 'received',
  `failure_reason` VARCHAR(1000) DEFAULT NULL,
  `retry_count` INT NOT NULL DEFAULT 0,
  `last_processed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_crm_contract_sync_source_request` (`source_request_id`),
  KEY `idx_biz_crm_contract_sync_contract_no` (`contract_no`),
  KEY `idx_biz_crm_contract_sync_company_name` (`company_name`),
  KEY `idx_biz_crm_contract_sync_enterprise_id` (`enterprise_id`),
  KEY `idx_biz_crm_contract_sync_status` (`process_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='CRM合同同步记录，不写企业合同台账';

CREATE TABLE IF NOT EXISTS `biz_crm_execution_order_sync_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `source_request_id` VARCHAR(128) NOT NULL,
  `order_no` VARCHAR(128) NOT NULL,
  `company_name` VARCHAR(255) NOT NULL,
  `contract_no` VARCHAR(128) DEFAULT NULL,
  `contract_review_status` VARCHAR(64) DEFAULT NULL,
  `execution_order_name` VARCHAR(500) NOT NULL,
  `is_carried_forward` VARCHAR(32) DEFAULT NULL,
  `execution_department` VARCHAR(128) DEFAULT NULL,
  `account_manager_name` VARCHAR(64) DEFAULT NULL,
  `product_manager_name` VARCHAR(64) DEFAULT NULL,
  `enterprise_id` BIGINT DEFAULT NULL,
  `enterprise_name` VARCHAR(255) DEFAULT NULL,
  `recognized_project_codes` VARCHAR(255) DEFAULT NULL,
  `intellectual_property_count` INT DEFAULT NULL,
  `declaration_ids_json` LONGTEXT DEFAULT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `process_status` VARCHAR(32) NOT NULL DEFAULT 'received',
  `failure_reason` VARCHAR(1000) DEFAULT NULL,
  `retry_count` INT NOT NULL DEFAULT 0,
  `last_processed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_biz_crm_execution_sync_source_request` (`source_request_id`),
  KEY `idx_biz_crm_execution_sync_order_no` (`order_no`),
  KEY `idx_biz_crm_execution_sync_company_name` (`company_name`),
  KEY `idx_biz_crm_execution_sync_contract_no` (`contract_no`),
  KEY `idx_biz_crm_execution_sync_enterprise_id` (`enterprise_id`),
  KEY `idx_biz_crm_execution_sync_status` (`process_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='CRM执行单同步记录';

CREATE TABLE IF NOT EXISTS `biz_crm_sync_attempt_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `record_type` VARCHAR(32) NOT NULL,
  `record_id` BIGINT NOT NULL,
  `attempt_type` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `operator_name` VARCHAR(64) DEFAULT NULL,
  `result_json` LONGTEXT DEFAULT NULL,
  `failure_reason` VARCHAR(1000) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_crm_sync_attempt_record` (`record_type`, `record_id`),
  KEY `idx_biz_crm_sync_attempt_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='CRM同步执行历史';

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Crm:Sync:List', 'CRM同步记录查看', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Crm:Sync:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Crm:Sync:Retry', 'CRM同步重新执行', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Crm:Sync:Retry');

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT role.`id`, permission.`id`, NOW(), NOW()
FROM `sys_role` role
JOIN `sys_permission` permission ON permission.`code` IN ('Crm:Sync:List', 'Crm:Sync:Retry')
WHERE role.`code` IN ('admin', 'super_admin')
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_permission` existed
    WHERE existed.`role_id` = role.`id` AND existed.`permission_id` = permission.`id`
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT 'admin', NULL, 'CrmSync', '/crm-sync', NULL, '/crm-sync/contracts',
  'catalog', 'lucide:refresh-cw', 'CRM同步', 153, 1, 'Crm:Sync:List', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_menu` WHERE `portal_type` = 'admin' AND `name` = 'CrmSync'
);

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.`portal_type`, parent.`id`, 'CrmContractSyncRecord', 'contracts',
  'crm-sync/contract-records/index', NULL, 'menu', 'lucide:file-text', '合同同步记录',
  1, 1, 'Crm:Sync:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.`portal_type` = 'admin' AND parent.`name` = 'CrmSync'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `portal_type` = 'admin' AND `name` = 'CrmContractSyncRecord'
  );

INSERT INTO `sys_menu` (
  `portal_type`, `parent_id`, `name`, `path`, `component`, `redirect_path`,
  `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.`portal_type`, parent.`id`, 'CrmExecutionOrderSyncRecord', 'execution-orders',
  'crm-sync/execution-order-records/index', NULL, 'menu', 'lucide:clipboard-list', '执行单同步记录',
  2, 1, 'Crm:Sync:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.`portal_type` = 'admin' AND parent.`name` = 'CrmSync'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_menu` WHERE `portal_type` = 'admin' AND `name` = 'CrmExecutionOrderSyncRecord'
  );
