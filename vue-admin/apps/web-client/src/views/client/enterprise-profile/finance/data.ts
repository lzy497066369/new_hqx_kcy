import type {
  EnterpriseOption,
  EnterpriseTableColumn,
} from '../components/table-types';

export const quarterOptions: EnterpriseOption[] = [
  { label: '全年', value: 1 },
];

export const financeFileClassOptions: EnterpriseOption[] = [
  { color: 'blue', label: '纳税申报表', value: 1 },
  { color: 'green', label: '审计报告', value: 2 },
  { color: 'default', label: '其他', value: 3 },
];

export const financialDataColumns: EnterpriseTableColumn[] = [
  { field: 'year', title: '年度', width: 100 },
  {
    customType: 'tag',
    field: 'q',
    options: quarterOptions,
    title: '季度',
    width: 100,
  },
  { field: 'xxsr', minWidth: 140, title: '销售收入' },
  { field: 'total_revenue', minWidth: 140, title: '总收入' },
  { field: 'main_business_income', minWidth: 150, title: '主营业务收入' },
  { field: 'high_tech_income', minWidth: 140, title: '高新收入' },
  { field: 'zxc', minWidth: 140, title: '总资产' },
  { field: 'net_assets', minWidth: 140, title: '净资产' },
  { field: 'yffy', minWidth: 140, title: '研发费用' },
  { field: 'fz', minWidth: 140, title: '负债' },
  { field: 'fzl', minWidth: 120, title: '负债率' },
  { field: 'lr_total', minWidth: 140, title: '利润总额' },
  { field: 'net_profit', minWidth: 140, title: '净利润' },
  { field: 'rd_personnel_cost', minWidth: 140, title: '人员人工' },
  { field: 'rd_direct_input', minWidth: 140, title: '直接投入' },
  { field: 'rd_depreciation', minWidth: 140, title: '折旧摊销' },
  { field: 'rd_intangible_amortization', minWidth: 150, title: '无形资产摊销' },
  { field: 'rd_design_fee', minWidth: 120, title: '设计费' },
  { field: 'rd_equipment_debugging_fee', minWidth: 150, title: '装备调试费' },
  { field: 'rd_entrusted_development', minWidth: 140, title: '委托研发' },
  { field: 'rd_other_expense', minWidth: 120, title: '其他费用' },
  { field: 'remark', minWidth: 180, title: '备注' },
];

export const taxAuditColumns: EnterpriseTableColumn[] = [
  {
    customType: 'tag',
    field: 'file_class',
    minWidth: 140,
    options: financeFileClassOptions,
    title: '文件类型',
  },
  { field: 'tax_category', minWidth: 160, title: '税种/报告类别' },
  { field: 'year', width: 100, title: '年度' },
  {
    customType: 'file',
    field: 'file_path',
    minWidth: 140,
    title: '文件',
  },
  { field: 'remark', minWidth: 220, title: '备注' },
];
