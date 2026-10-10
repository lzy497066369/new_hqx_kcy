import type {
  EnterpriseOption,
  EnterpriseTableColumn,
} from '../components/table-types';

export const ruleClassOptions: EnterpriseOption[] = [
  { color: 'blue', label: '研发组织管理', value: 1 },
  { color: 'cyan', label: '研发财务核算', value: 2 },
  { color: 'green', label: '研发机构与产学研', value: 3 },
  { color: 'purple', label: '成果转化与创新平台', value: 4 },
  { color: 'orange', label: '人才培养与绩效激励', value: 5 },
];

export const ruleStatusOptions: EnterpriseOption[] = [
  { color: 'success', label: '生效中', value: 1 },
  { color: 'default', label: '草稿', value: 2 },
  { color: 'warning', label: '已归档', value: 3 },
];

export const ruleDocumentColumns: EnterpriseTableColumn[] = [
  { field: 'file_title', minWidth: 180, title: '文件标题' },
  {
    customType: 'tag',
    field: 'file_class',
    minWidth: 180,
    options: ruleClassOptions,
    title: '文件分类',
  },
  {
    customType: 'tag',
    field: 'file_status',
    minWidth: 120,
    options: ruleStatusOptions,
    title: '文件状态',
  },
  { field: 'file_version', minWidth: 120, title: '文件版本' },
  { field: 'file_start_date', minWidth: 130, title: '生效日期' },
  { field: 'file_remark', minWidth: 220, title: '文件说明' },
  {
    customType: 'file',
    field: 'file_path',
    minWidth: 120,
    title: '文件',
  },
];
