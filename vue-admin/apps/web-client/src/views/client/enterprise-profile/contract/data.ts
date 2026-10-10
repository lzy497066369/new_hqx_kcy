import type {
  EnterpriseOption,
  EnterpriseTableColumn,
} from '../components/table-types';

export const contractStatusOptions: EnterpriseOption[] = [
  { color: 'processing', label: '执行中', value: 1 },
  { color: 'success', label: '已完成', value: 2 },
  { color: 'warning', label: '已过期', value: 3 },
];

export const invoiceStatusOptions: EnterpriseOption[] = [
  { color: 'warning', label: '未支付', value: 1 },
  { color: 'success', label: '已支付', value: 2 },
  { color: 'processing', label: '部分已支付', value: 3 },
];

export const contractColumns: EnterpriseTableColumn[] = [
  { field: 'ht_name', minWidth: 180, title: '合同名称' },
  { field: 'ht_num', minWidth: 150, title: '合同编号' },
  { field: 'kh_name', minWidth: 160, title: '客户名称' },
  { field: 'qd_date', minWidth: 130, title: '签订日期' },
  { field: 'ht_money', minWidth: 130, title: '合同金额' },
  {
    customType: 'tag',
    field: 'ht_status',
    minWidth: 120,
    options: contractStatusOptions,
    title: '合同状态',
  },
  { field: 'start_date', minWidth: 130, title: '生效日期' },
  { field: 'end_date', minWidth: 130, title: '截止日期' },
  { field: 'ht_des', minWidth: 220, title: '合同描述' },
  {
    customType: 'file',
    field: 'ht_path',
    minWidth: 120,
    title: '合同文件',
  },
];

export const invoiceColumns: EnterpriseTableColumn[] = [
  { field: 'fp_num', minWidth: 150, title: '发票编号' },
  { field: 'fp_date', minWidth: 130, title: '开票日期' },
  { field: 'fp_money', minWidth: 130, title: '发票金额' },
  {
    customType: 'tag',
    field: 'fp_status',
    minWidth: 130,
    options: invoiceStatusOptions,
    title: '发票状态',
  },
  { field: 'zf_date', minWidth: 130, title: '支付日期' },
  { field: 'remark', minWidth: 220, title: '备注' },
];
