-- CRM 业务事件版本化：补充业务键、更新时间、版本号和事件类型，支持新增/修改/作废的追加式同步。

ALTER TABLE `biz_crm_contract_sync_record`
  ADD COLUMN `source_record_id` VARCHAR(128) DEFAULT NULL AFTER `source_request_id`,
  ADD COLUMN `source_updated_at` DATETIME DEFAULT NULL AFTER `source_record_id`,
  ADD COLUMN `source_version` VARCHAR(64) DEFAULT NULL AFTER `source_updated_at`,
  ADD COLUMN `event_type` VARCHAR(32) NOT NULL DEFAULT 'created' AFTER `source_version`,
  ADD KEY `idx_biz_crm_contract_sync_source_record_id` (`source_record_id`),
  ADD KEY `idx_biz_crm_contract_sync_source_updated_at` (`source_updated_at`),
  ADD KEY `idx_biz_crm_contract_sync_event_type` (`event_type`);

ALTER TABLE `biz_crm_execution_order_sync_record`
  ADD COLUMN `source_record_id` VARCHAR(128) DEFAULT NULL AFTER `source_request_id`,
  ADD COLUMN `source_updated_at` DATETIME DEFAULT NULL AFTER `source_record_id`,
  ADD COLUMN `source_version` VARCHAR(64) DEFAULT NULL AFTER `source_updated_at`,
  ADD COLUMN `event_type` VARCHAR(32) NOT NULL DEFAULT 'created' AFTER `source_version`,
  ADD KEY `idx_biz_crm_execution_sync_source_record_id` (`source_record_id`),
  ADD KEY `idx_biz_crm_execution_sync_source_updated_at` (`source_updated_at`),
  ADD KEY `idx_biz_crm_execution_sync_event_type` (`event_type`);
