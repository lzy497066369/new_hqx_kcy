export interface EnterpriseOption {
  color?: string;
  label: string;
  value: number | string;
}

export interface EnterpriseTableColumn {
  customType?: 'file' | 'tag';
  editorType?: 'date' | 'multiSelect' | 'select' | 'textarea';
  field: string;
  formGroup?: string;
  formSpan?: 1 | 2;
  minWidth?: number;
  options?: EnterpriseOption[];
  placeholder?: string;
  readonly?: boolean;
  required?: boolean;
  title: string;
  width?: number;
}

export interface EnterpriseRecordTab {
  columns: EnterpriseTableColumn[];
  description?: string;
  emptyDescription: string;
  key: string;
  records: Record<string, unknown>[];
  title: string;
}
