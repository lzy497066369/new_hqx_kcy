export type ArchiveRecordType = 'accounts' | 'contracts' | 'documents' | 'invoices';
export type ArchiveLedgerSection = 'account' | 'contract' | 'document';

export type ArchiveFieldKind = 'date' | 'file' | 'number' | 'select' | 'textarea' | 'text';

export interface ArchiveFieldOption {
  color?: string;
  label: string;
  value: number | string;
}

export interface ArchiveRecordField {
  key: string;
  kind: ArchiveFieldKind;
  label: string;
  options?: ArchiveFieldOption[];
  required?: boolean;
  requiredOnCreate?: boolean;
  sensitive?: boolean;
  showInTable?: boolean;
  width?: number;
}

export interface ArchiveRecordConfig {
  attachment?: { field: string; type: 'contract' | 'document' | 'invoice' };
  fields: ArchiveRecordField[];
  primary: string;
  title: string;
}

const contractStatusOptions: ArchiveFieldOption[] = [
  { color: 'processing', label: '执行中', value: 1 },
  { color: 'success', label: '已完成', value: 2 },
  { color: 'warning', label: '已过期', value: 3 },
];

const invoiceStatusOptions: ArchiveFieldOption[] = [
  { color: 'warning', label: '未支付', value: 1 },
  { color: 'success', label: '已支付', value: 2 },
  { color: 'processing', label: '部分已支付', value: 3 },
];

const documentClassOptions: ArchiveFieldOption[] = [
  { color: 'blue', label: '研发组织管理', value: 1 },
  { color: 'cyan', label: '研发财务核算', value: 2 },
  { color: 'green', label: '研发机构与产学研', value: 3 },
  { color: 'purple', label: '成果转化与创新平台', value: 4 },
  { color: 'orange', label: '人才培养与绩效激励', value: 5 },
];

const documentStatusOptions: ArchiveFieldOption[] = [
  { color: 'success', label: '生效中', value: 1 },
  { color: 'default', label: '草稿', value: 2 },
  { color: 'warning', label: '已归档', value: 3 },
];

export const archiveRecordConfigs: Record<ArchiveRecordType, ArchiveRecordConfig> = {
  accounts: {
    fields: [
      { key: 'ptName', kind: 'text', label: '平台名称', required: true, width: 180 },
      { key: 'ptUrl', kind: 'text', label: '平台网址', width: 220 },
      { key: 'zhType', kind: 'select', label: '账号类型', options: [
        { label: '高新技术企业账号', value: 1 },
        { label: '国家信息安全网', value: 2 },
        { label: '软件著作权登记系统', value: 3 },
        { label: '版权保护登记系统', value: 4 },
        { label: '国家税务局税务系统', value: 5 },
        { label: '省级科技创新平台', value: 6 },
        { label: '知识产权管理平台', value: 7 },
      ], width: 180 },
      { key: 'zhNumber', kind: 'text', label: '账号', required: true, width: 180 },
      { key: 'zhPassword', kind: 'text', label: '密码', requiredOnCreate: true, sensitive: true, showInTable: false, width: 120 },
      { key: 'charge', kind: 'text', label: '负责人', width: 130 },
      { key: 'bPhone', kind: 'text', label: '联系电话', width: 140 },
      { key: 'bEmail', kind: 'text', label: '联系邮箱', width: 200 },
      { key: 'gsbm', kind: 'text', label: '归属编码', width: 130 },
      { key: 'endDate', kind: 'date', label: '到期日期', width: 130 },
      { key: 'zhStatus', kind: 'select', label: '状态', options: [{ color: 'success', label: '启用', value: 1 }, { color: 'default', label: '停用', value: 0 }], width: 110 },
      { key: 'remark', kind: 'textarea', label: '备注', width: 220 },
    ],
    primary: 'ptName',
    title: '企业账号',
  },
  contracts: {
    attachment: { field: 'htPath', type: 'contract' },
    fields: [
      { key: 'htName', kind: 'text', label: '合同名称', required: true, width: 180 },
      { key: 'htNum', kind: 'text', label: '合同编号', width: 150 },
      { key: 'khName', kind: 'text', label: '客户名称', width: 160 },
      { key: 'qdDate', kind: 'date', label: '签订日期', width: 130 },
      { key: 'htMoney', kind: 'number', label: '合同金额', width: 130 },
      { key: 'htStatus', kind: 'select', label: '合同状态', options: contractStatusOptions, width: 120 },
      { key: 'startDate', kind: 'date', label: '生效日期', width: 130 },
      { key: 'endDate', kind: 'date', label: '截止日期', width: 130 },
      { key: 'htDes', kind: 'textarea', label: '合同描述', width: 240 },
      { key: 'htPath', kind: 'file', label: '合同文件', width: 130 },
    ],
    primary: 'htName',
    title: '合同',
  },
  documents: {
    attachment: { field: 'filePath', type: 'document' },
    fields: [
      { key: 'fileTitle', kind: 'text', label: '文件标题', required: true, width: 200 },
      { key: 'fileClass', kind: 'select', label: '文件分类', options: documentClassOptions, width: 180 },
      { key: 'fileStatus', kind: 'select', label: '文件状态', options: documentStatusOptions, width: 120 },
      { key: 'fileVersion', kind: 'text', label: '文件版本', width: 120 },
      { key: 'fileStartDate', kind: 'date', label: '生效日期', width: 130 },
      { key: 'fileRemark', kind: 'textarea', label: '文件说明', width: 240 },
      { key: 'filePath', kind: 'file', label: '文件', width: 120 },
    ],
    primary: 'fileTitle',
    title: '制度文件',
  },
  invoices: {
    attachment: { field: 'fpPath', type: 'invoice' },
    fields: [
      { key: 'fpNum', kind: 'text', label: '发票号码', required: true, width: 150 },
      { key: 'htId', kind: 'select', label: '关联合同', width: 180 },
      { key: 'fpDate', kind: 'date', label: '开票日期', width: 130 },
      { key: 'fpMoney', kind: 'number', label: '发票金额', width: 130 },
      { key: 'fpStatus', kind: 'select', label: '发票状态', options: invoiceStatusOptions, width: 130 },
      { key: 'zfDate', kind: 'date', label: '支付日期', width: 130 },
      { key: 'remark', kind: 'textarea', label: '备注', width: 240 },
      { key: 'fpPath', kind: 'file', label: '发票文件', width: 130 },
    ],
    primary: 'fpNum',
    title: '发票',
  },
};

export function getArchiveLedgerTabs(section: ArchiveLedgerSection | string): ArchiveRecordType[] {
  if (section === 'contract') return ['contracts', 'invoices'];
  if (section === 'document') return ['documents'];
  if (section === 'account') return ['accounts'];
  return ['contracts', 'invoices', 'documents', 'accounts'];
}

export function getArchiveFieldOption(field: ArchiveRecordField, value: unknown) {
  return field.options?.find((item) => String(item.value) === String(value));
}
