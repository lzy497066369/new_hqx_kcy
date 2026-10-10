import type {
  EnterpriseOption,
  EnterpriseTableColumn,
} from '../components/table-types';

export const employeeGenderOptions: EnterpriseOption[] = [
  { color: 'blue', label: '男', value: 1 },
  { color: 'pink', label: '女', value: 2 },
];

export const employeeEducationOptions: EnterpriseOption[] = [
  { label: '博士', value: 1 },
  { label: '硕士', value: 2 },
  { label: '本科', value: 3 },
  { label: '大专及以下', value: 4 },
];

export const employeeTypeOptions: EnterpriseOption[] = [
  { label: '在职人员', value: 1 },
  { label: '兼职人员', value: 2 },
  { label: '临时兼职人员', value: 3 },
  { label: '临时聘用人员', value: 4 },
];

export const jobTitleOptions: EnterpriseOption[] = [
  { label: '高级职称', value: 1 },
  { label: '中级职称', value: 2 },
  { label: '初级职称', value: 3 },
  { label: '高级技工', value: 4 },
  { label: '暂无', value: 5 },
];

export const ageRangeOptions: EnterpriseOption[] = [
  { label: '30岁以下', value: 1 },
  { label: '31-40岁', value: 2 },
  { label: '41-50岁', value: 3 },
  { label: '50岁及以上', value: 4 },
];

export const yesNoOptions: EnterpriseOption[] = [
  { color: 'green', label: '是', value: 1 },
  { color: 'default', label: '否', value: 0 },
];

export const employeeColumns: EnterpriseTableColumn[] = [
  { field: 'yg_name', minWidth: 120, title: '员工姓名' },
  { field: 'department', minWidth: 120, title: '部门' },
  { field: 'position', minWidth: 120, title: '岗位' },
  {
    customType: 'tag',
    field: 'yg_sex',
    options: employeeGenderOptions,
    width: 100,
    title: '性别',
  },
  {
    customType: 'tag',
    field: 'yg_lx',
    minWidth: 140,
    options: employeeTypeOptions,
    title: '员工类型',
  },
  {
    customType: 'tag',
    field: 'is_active',
    minWidth: 110,
    options: yesNoOptions,
    title: '在职',
  },
  {
    customType: 'tag',
    field: 'yg_xl',
    minWidth: 120,
    options: employeeEducationOptions,
    title: '学历',
  },
  {
    customType: 'tag',
    field: 'yg_zc',
    minWidth: 120,
    options: jobTitleOptions,
    title: '职称',
  },
  {
    customType: 'tag',
    field: 'yg_nl',
    minWidth: 120,
    options: ageRangeOptions,
    title: '年龄段',
  },
  {
    customType: 'tag',
    field: 'is_kjyf',
    minWidth: 120,
    options: yesNoOptions,
    title: '科研人员',
  },
  { field: 'rd_projects', minWidth: 140, title: '参与RD' },
  { field: 'annual_work_days', minWidth: 130, title: '全年工作天数' },
  { field: 'entry_date', minWidth: 120, title: '入职日期' },
  { field: 'id_card', minWidth: 180, title: '身份证号' },
  {
    customType: 'tag',
    field: 'yg_wj',
    minWidth: 120,
    options: yesNoOptions,
    title: '外籍人员',
  },
  {
    customType: 'tag',
    field: 'yg_lxgg',
    minWidth: 150,
    options: yesNoOptions,
    title: '留学归国人员',
  },
  {
    customType: 'tag',
    field: 'yg_qr',
    minWidth: 140,
    options: yesNoOptions,
    title: '千人计划人员',
  },
  { field: 'remark', minWidth: 180, title: '备注' },
  {
    customType: 'file',
    field: 'yg_files',
    minWidth: 120,
    title: '综合附件',
  },
  {
    customType: 'file',
    field: 'labor_contract_file',
    minWidth: 140,
    title: '劳动合同',
  },
  {
    customType: 'file',
    field: 'social_security_file',
    minWidth: 120,
    title: '社保',
  },
];
