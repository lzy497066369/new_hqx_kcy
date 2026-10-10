-- P0 财税导入闭环：财务字段扩展和导入错误明细表
-- 如当前数据库已存在某些字段，请跳过对应 ALTER 语句。

ALTER TABLE `biz_enterprise_finance_record`
  ADD COLUMN `net_assets` varchar(64) NULL COMMENT '净资产' AFTER `zxc`,
  ADD COLUMN `total_revenue` varchar(64) NULL COMMENT '总收入' AFTER `yffy`,
  ADD COLUMN `main_business_income` varchar(64) NULL COMMENT '主营业务收入' AFTER `total_revenue`,
  ADD COLUMN `high_tech_income` varchar(64) NULL COMMENT '高新收入' AFTER `main_business_income`,
  ADD COLUMN `net_profit` varchar(64) NULL COMMENT '净利润' AFTER `lr_total`,
  ADD COLUMN `rd_personnel_cost` varchar(64) NULL COMMENT '研发费用-人员人工' AFTER `net_profit`,
  ADD COLUMN `rd_direct_input` varchar(64) NULL COMMENT '研发费用-直接投入' AFTER `rd_personnel_cost`,
  ADD COLUMN `rd_depreciation` varchar(64) NULL COMMENT '研发费用-折旧摊销' AFTER `rd_direct_input`,
  ADD COLUMN `rd_intangible_amortization` varchar(64) NULL COMMENT '研发费用-无形资产摊销' AFTER `rd_depreciation`,
  ADD COLUMN `rd_design_fee` varchar(64) NULL COMMENT '研发费用-设计费' AFTER `rd_intangible_amortization`,
  ADD COLUMN `rd_equipment_debugging_fee` varchar(64) NULL COMMENT '研发费用-装备调试费' AFTER `rd_design_fee`,
  ADD COLUMN `rd_entrusted_development` varchar(64) NULL COMMENT '研发费用-委托研发' AFTER `rd_equipment_debugging_fee`,
  ADD COLUMN `rd_other_expense` varchar(64) NULL COMMENT '研发费用-其他费用' AFTER `rd_entrusted_development`;

CREATE TABLE IF NOT EXISTS `biz_enterprise_material_parse_error` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `enterprise_id` bigint NOT NULL COMMENT '企业ID',
  `material_id` bigint NOT NULL COMMENT '材料记录ID',
  `sheet_name` varchar(64) DEFAULT NULL COMMENT '工作表/导入区',
  `row_number` int DEFAULT NULL COMMENT '行号',
  `field_name` varchar(128) DEFAULT NULL COMMENT '字段名',
  `raw_value` varchar(500) DEFAULT NULL COMMENT '原始值',
  `error_message` varchar(255) NOT NULL COMMENT '错误原因',
  `suggestion` varchar(255) DEFAULT NULL COMMENT '修正建议',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_enterprise_material_parse_error` (`enterprise_id`, `material_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业材料导入错误明细';
