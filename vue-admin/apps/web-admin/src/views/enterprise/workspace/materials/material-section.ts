export type ArchiveTab =
  | 'accounts'
  | 'certificates'
  | 'contracts'
  | 'documents'
  | 'invoices';

export type MaterialSectionKey =
  | 'account'
  | 'basic'
  | 'certificate'
  | 'company'
  | 'contract'
  | 'document'
  | 'employee'
  | 'finance'
  | 'intellectual_property'
  | 'materials'
  | 'photo';

export type MaterialSectionView =
  | 'accounts'
  | 'certificates'
  | 'company'
  | 'contracts'
  | 'documents'
  | 'finance'
  | 'employees'
  | 'profile'
  | 'properties'
  | 'templates'
  | 'photos';

export interface MaterialSectionConfig {
  archiveTab?: ArchiveTab;
  icon: string;
  key: MaterialSectionKey;
  title: string;
  view: MaterialSectionView;
}

export interface MaterialSectionTarget {
  section: MaterialSectionKey;
  tab?: string;
}

const materialSectionConfigs: readonly MaterialSectionConfig[] = [
  { icon: 'lucide:building-2', key: 'company', title: '公司资料', view: 'company' },
  { icon: 'lucide:clipboard-pen-line', key: 'basic', title: '企业基础档案', view: 'profile' },
  { icon: 'lucide:users-round', key: 'employee', title: '员工', view: 'employees' },
  { icon: 'lucide:landmark', key: 'finance', title: '财税', view: 'finance' },
  { archiveTab: 'contracts', icon: 'lucide:file-text', key: 'contract', title: '合同和发票', view: 'contracts' },
  { icon: 'lucide:badge-check', key: 'intellectual_property', title: '研发与知识产权', view: 'properties' },
  { archiveTab: 'documents', icon: 'lucide:book-open-check', key: 'document', title: '制度文件', view: 'documents' },
  { icon: 'lucide:award', key: 'certificate', title: '企业证书', view: 'certificates' },
  { icon: 'lucide:image', key: 'photo', title: '照片', view: 'photos' },
  { archiveTab: 'accounts', icon: 'lucide:key-round', key: 'account', title: '企业账号', view: 'accounts' },
  { icon: 'lucide:files', key: 'materials', title: '导入记录', view: 'templates' },
] as const;

export const materialSections = materialSectionConfigs.filter(
  (item) => item.key !== 'materials',
);
export const materialSectionKeys = materialSectionConfigs.map((item) => item.key);

const materialMenuRouteSections: Readonly<Record<string, MaterialSectionKey>> = {
  EnterpriseMaterialAccounts: 'account',
  EnterpriseMaterialBasic: 'basic',
  EnterpriseMaterialCertificates: 'certificate',
  EnterpriseMaterialContacts: 'basic',
  EnterpriseMaterialContracts: 'contract',
  EnterpriseMaterialDocuments: 'document',
  EnterpriseMaterialEmployees: 'employee',
  EnterpriseMaterialFinance: 'finance',
  EnterpriseMaterialOverview: 'company',
  EnterpriseMaterialPhotos: 'photo',
  EnterpriseMaterialProperties: 'intellectual_property',
};

const materialSectionTargets: Readonly<Record<string, MaterialSectionTarget>> = {
  'account/accounts': { section: 'account', tab: 'accounts' },
  'basic/info': { section: 'basic' },
  'basic/shareholders': { section: 'basic' },
  'certificate/certificates': { section: 'certificate' },
  'contract/contracts': { section: 'contract', tab: 'contracts' },
  'contract/invoices': { section: 'contract', tab: 'invoices' },
  'document/documents': { section: 'document', tab: 'documents' },
  'employee/employees': { section: 'employee' },
  'finance/financial': { section: 'finance', tab: 'financial' },
  'finance/taxAudit': { section: 'finance', tab: 'taxAudit' },
  'photo/photos': { section: 'photo' },
  'property/intellectualProperty': { section: 'intellectual_property', tab: 'ip' },
  'property/productService': { section: 'intellectual_property', tab: 'ps' },
  'property/researchProject': { section: 'intellectual_property', tab: 'rd' },
  'property/transformation': { section: 'intellectual_property', tab: 'transformation' },
};

const materialModuleSections: Readonly<Record<string, MaterialSectionKey>> = {
  account: 'account',
  basic: 'basic',
  certificate: 'certificate',
  contract: 'contract',
  document: 'document',
  employee: 'employee',
  finance: 'finance',
  photo: 'photo',
  property: 'intellectual_property',
};

export function isMaterialSectionKey(value: string): value is MaterialSectionKey {
  return materialSectionKeys.includes(value as MaterialSectionKey);
}

export function resolveMaterialLedgerSection(
  section: string | undefined,
  routeName?: string | symbol | undefined,
): MaterialSectionKey {
  if (section === 'contacts') return 'basic';
  if (section && isMaterialSectionKey(section)) return section;
  return typeof routeName === 'string'
    ? (materialMenuRouteSections[routeName] ?? 'company')
    : 'company';
}

export function getMaterialSectionConfig(key: MaterialSectionKey) {
  return materialSectionConfigs.find((item) => item.key === key)!;
}

export function getMaterialSectionTarget(
  moduleKey?: string,
  tabKey?: string,
): MaterialSectionTarget | undefined {
  if (!moduleKey) return undefined;
  const target = materialSectionTargets[`${moduleKey}/${tabKey ?? ''}`];
  if (target) return target;

  const section = materialModuleSections[moduleKey]
    ?? (isMaterialSectionKey(moduleKey) ? moduleKey : undefined);
  return section ? { section } : undefined;
}
