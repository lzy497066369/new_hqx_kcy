import type { EnterpriseMetricKey } from './declaration-scheme-types';

export type EnterpriseMetricCatalogItem = {
  key: EnterpriseMetricKey;
  label: string;
  source: string;
  unit: string;
  valueType: EnterpriseMetricValueType;
};

export type EnterpriseMetricValueType = 'boolean' | 'number';

export const enterpriseMetricCatalog: EnterpriseMetricCatalogItem[] = [
  { key: 'account_high_tech_declaration_exists', label: '企业高企申报账号是否存在', source: '账号信息', unit: '是/否', valueType: 'boolean' },
  { key: 'account_soft_copyright_exists', label: '软件著作权账号是否存在', source: '账号信息', unit: '是/否', valueType: 'boolean' },
  { key: 'balance_sheet_exists', label: '科目余额表是否上传', source: '财务附件', unit: '是/否', valueType: 'boolean' },
  { key: 'business_license_exists', label: '营业执照是否存在', source: '企业证书', unit: '是/否', valueType: 'boolean' },
  { key: 'contract_count', label: '合同数量', source: '合同发票', unit: '份', valueType: 'number' },
  { key: 'employee_attachment_count', label: '有附件员工数量', source: '员工档案', unit: '人', valueType: 'number' },
  { key: 'employee_attachment_coverage_ratio', label: '员工附件覆盖率', source: '员工档案', unit: '%', valueType: 'number' },
  { key: 'employee_count', label: '员工人数', source: '员工档案', unit: '人', valueType: 'number' },
  { key: 'equipment_photo_exists', label: '设备照片是否存在', source: '企业照片', unit: '是/否', valueType: 'boolean' },
  { key: 'enterprise_age_days', label: '企业成立天数', source: '企业基本资料', unit: '天', valueType: 'number' },
  { key: 'finance_year_count', label: '经营数据年度数量', source: '财务资料', unit: '年', valueType: 'number' },
  { key: 'financial_statement_exists', label: '财务报表是否上传', source: '财务附件', unit: '是/否', valueType: 'boolean' },
  { key: 'gaoxin_financial_period_complete', label: '高企实际经营期财务年度是否齐全', source: '财务资料', unit: '是/否', valueType: 'boolean' },
  { key: 'core_ip_exists', label: '是否存在核心知识产权', source: '知识产权档案', unit: '是/否', valueType: 'boolean' },
  { key: 'ip_count', label: '知识产权数量', source: '知识产权档案', unit: '项', valueType: 'number' },
  { key: 'ip_rd_ps_chain_complete', label: 'IP-RD-PS-成果转化链路是否完善', source: '研发与知识产权', unit: '是/否', valueType: 'boolean' },
  { key: 'invoice_count', label: '发票数量', source: '合同发票', unit: '张', valueType: 'number' },
  { key: 'latest_high_tech_income', label: '最近一年高新技术产品收入', source: '财务资料', unit: '万元', valueType: 'number' },
  { key: 'latest_high_tech_income_ratio', label: '最近一年高新技术产品收入占比', source: '财务资料', unit: '%', valueType: 'number' },
  { key: 'latest_total_revenue', label: '最近一年销售收入', source: '财务资料', unit: '万元', valueType: 'number' },
  { key: 'personnel_info_exists', label: '人员情况是否存在', source: '员工档案', unit: '是/否', valueType: 'boolean' },
  { key: 'sequence_ledger_exists', label: '序时账是否上传', source: '财务附件', unit: '是/否', valueType: 'boolean' },
  { key: 'site_photo_exists', label: '场地照片是否存在', source: '企业照片', unit: '是/否', valueType: 'boolean' },
  { key: 'tech_employee_count', label: '科技人员数量', source: '员工档案', unit: '人', valueType: 'number' },
  { key: 'tech_employee_ratio', label: '科技人员占比', source: '员工档案', unit: '%', valueType: 'number' },
  { key: 'three_year_rd_expense_ratio', label: '近三年研发费用占销售收入比例', source: '财务资料', unit: '%', valueType: 'number' },
  { key: 'three_year_rd_expense_ratio_required', label: '高企研发费用占比适用门槛', source: '财务资料', unit: '%', valueType: 'number' },
  { key: 'three_year_rd_expense_ratio_qualified', label: '高企研发费用占比是否达标', source: '财务资料', unit: '是/否', valueType: 'boolean' },
  { key: 'training_photo_exists', label: '人员培训照片是否存在', source: '企业照片', unit: '是/否', valueType: 'boolean' },
];

export function getEnterpriseMetricCatalogItem(key?: EnterpriseMetricKey) {
  return enterpriseMetricCatalog.find((item) => item.key === key);
}
