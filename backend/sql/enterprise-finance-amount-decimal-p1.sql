-- 财税金额统一以万元为口径，数据库保存为纯数值 DECIMAL(20,2)。
-- 历史数据仅移除千分位和单位文本，不按数值大小猜测并换算，避免重复除以一万。

UPDATE `biz_enterprise_finance_record`
SET
  `xxsr` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`xxsr`), ',', ''), '万元', ''), '元', ''), ''),
  `zxc` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`zxc`), ',', ''), '万元', ''), '元', ''), ''),
  `net_assets` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`net_assets`), ',', ''), '万元', ''), '元', ''), ''),
  `yffy` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`yffy`), ',', ''), '万元', ''), '元', ''), ''),
  `total_revenue` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`total_revenue`), ',', ''), '万元', ''), '元', ''), ''),
  `main_business_income` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`main_business_income`), ',', ''), '万元', ''), '元', ''), ''),
  `high_tech_income` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`high_tech_income`), ',', ''), '万元', ''), '元', ''), ''),
  `fz` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`fz`), ',', ''), '万元', ''), '元', ''), ''),
  `lr_total` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`lr_total`), ',', ''), '万元', ''), '元', ''), ''),
  `net_profit` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`net_profit`), ',', ''), '万元', ''), '元', ''), ''),
  `rd_personnel_cost` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`rd_personnel_cost`), ',', ''), '万元', ''), '元', ''), ''),
  `rd_direct_input` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`rd_direct_input`), ',', ''), '万元', ''), '元', ''), ''),
  `rd_depreciation` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`rd_depreciation`), ',', ''), '万元', ''), '元', ''), ''),
  `rd_intangible_amortization` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`rd_intangible_amortization`), ',', ''), '万元', ''), '元', ''), ''),
  `rd_design_fee` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`rd_design_fee`), ',', ''), '万元', ''), '元', ''), ''),
  `rd_equipment_debugging_fee` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`rd_equipment_debugging_fee`), ',', ''), '万元', ''), '元', ''), ''),
  `rd_entrusted_development` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`rd_entrusted_development`), ',', ''), '万元', ''), '元', ''), ''),
  `rd_other_expense` = NULLIF(REPLACE(REPLACE(REPLACE(TRIM(`rd_other_expense`), ',', ''), '万元', ''), '元', ''), '');

ALTER TABLE `biz_enterprise_finance_record`
  MODIFY COLUMN `xxsr` DECIMAL(20,2) NULL,
  MODIFY COLUMN `zxc` DECIMAL(20,2) NULL,
  MODIFY COLUMN `net_assets` DECIMAL(20,2) NULL,
  MODIFY COLUMN `yffy` DECIMAL(20,2) NULL,
  MODIFY COLUMN `total_revenue` DECIMAL(20,2) NULL,
  MODIFY COLUMN `main_business_income` DECIMAL(20,2) NULL,
  MODIFY COLUMN `high_tech_income` DECIMAL(20,2) NULL,
  MODIFY COLUMN `fz` DECIMAL(20,2) NULL,
  MODIFY COLUMN `lr_total` DECIMAL(20,2) NULL,
  MODIFY COLUMN `net_profit` DECIMAL(20,2) NULL,
  MODIFY COLUMN `rd_personnel_cost` DECIMAL(20,2) NULL,
  MODIFY COLUMN `rd_direct_input` DECIMAL(20,2) NULL,
  MODIFY COLUMN `rd_depreciation` DECIMAL(20,2) NULL,
  MODIFY COLUMN `rd_intangible_amortization` DECIMAL(20,2) NULL,
  MODIFY COLUMN `rd_design_fee` DECIMAL(20,2) NULL,
  MODIFY COLUMN `rd_equipment_debugging_fee` DECIMAL(20,2) NULL,
  MODIFY COLUMN `rd_entrusted_development` DECIMAL(20,2) NULL,
  MODIFY COLUMN `rd_other_expense` DECIMAL(20,2) NULL;
