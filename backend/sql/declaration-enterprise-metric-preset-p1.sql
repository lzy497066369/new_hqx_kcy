-- 企业指标预设默认样例。指标 key 的取值由服务端读取企业资料，阈值在预设中维护。
INSERT INTO `biz_declaration_preset` (
  `preset_type`, `name`, `version`, `status`, `description`, `payload_json`, `created_at`, `updated_at`
)
SELECT
  'enterprise',
  '高企-企业资料完整度指标',
  'v1',
  'published',
  '国家高新技术企业资料完整度预设：覆盖经营数据、人员、账号、营业执照、员工附件、合同发票、照片、IP-RD-PS链路和财务附件。',
  '{"mode":"all","rules":[{"key":"finance_year_count","label":"经营数据年度数量","operator":"gte","value":1},{"key":"personnel_info_exists","label":"人员情况是否存在","operator":"gte","value":1},{"key":"account_soft_copyright_exists","label":"软件著作权账号是否存在","operator":"gte","value":1},{"key":"business_license_exists","label":"营业执照是否存在","operator":"gte","value":1},{"key":"employee_attachment_coverage_ratio","label":"员工附件覆盖率","operator":"gte","value":100},{"key":"contract_count","label":"合同数量","operator":"gte","value":1},{"key":"invoice_count","label":"发票数量","operator":"gte","value":1},{"key":"equipment_photo_exists","label":"设备照片是否存在","operator":"gte","value":1},{"key":"site_photo_exists","label":"场地照片是否存在","operator":"gte","value":1},{"key":"training_photo_exists","label":"人员培训照片是否存在","operator":"gte","value":1},{"key":"account_high_tech_declaration_exists","label":"企业高企申报账号是否存在","operator":"gte","value":1},{"key":"ip_rd_ps_chain_complete","label":"IP-RD-PS-成果转化链路是否完善","operator":"gte","value":1},{"key":"financial_statement_exists","label":"财务报表是否上传","operator":"gte","value":1},{"key":"balance_sheet_exists","label":"科目余额表是否上传","operator":"gte","value":1},{"key":"sequence_ledger_exists","label":"序时账是否上传","operator":"gte","value":1}]}',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM `biz_declaration_preset`
  WHERE `preset_type` = 'enterprise'
    AND `name` = '高企-企业资料完整度指标'
    AND `version` = 'v1'
);
