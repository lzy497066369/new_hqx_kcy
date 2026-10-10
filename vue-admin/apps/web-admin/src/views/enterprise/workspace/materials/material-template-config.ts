export type MaterialTemplateImportMode = 'direct' | 'employee-preview';

export interface MaterialTemplateConfig {
  accept: string;
  fileName: string;
  importMode: MaterialTemplateImportMode;
}

const materialTemplateConfigs: Record<string, MaterialTemplateConfig> = {
  'employee-info': {
    accept: '.xlsx,.xlsm,.xls',
    fileName: '员工花名册模板.xlsx',
    importMode: 'employee-preview',
  },
  'finance-info': { accept: '.csv', fileName: '财务信息模板.csv', importMode: 'direct' },
  'ip-info': { accept: '.csv', fileName: '知识产权模板.csv', importMode: 'direct' },
  'ps-info': { accept: '.csv', fileName: '高新产品PS模板.csv', importMode: 'direct' },
  'rd-info': { accept: '.csv', fileName: '研发项目RD模板.csv', importMode: 'direct' },
  'transformation-info': { accept: '.csv', fileName: '成果转化模板.csv', importMode: 'direct' },
};

const defaultMaterialTemplateConfig: MaterialTemplateConfig = {
  accept: '*/*',
  fileName: '企业资料模板',
  importMode: 'direct',
};

export function getMaterialTemplateConfig(templateId: string): MaterialTemplateConfig {
  return materialTemplateConfigs[templateId] ?? defaultMaterialTemplateConfig;
}
