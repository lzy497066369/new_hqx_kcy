import {
  EnterpriseAccountStatus,
  EnterpriseAccountType,
} from '#/api/client/enterprise-account';

export type EnterpriseAccountFormMode = 'create' | 'edit';

export const enterpriseAccountTypeOptions = [
  {
    label: '高新技术企业账号',
    value: EnterpriseAccountType.HighTech,
  },
  {
    label: '国家信息安全网',
    value: EnterpriseAccountType.NationalSecurity,
  },
  {
    label: '软件著作权登记系统',
    value: EnterpriseAccountType.SoftwareCopyright,
  },
  {
    label: '版权保护登记系统',
    value: EnterpriseAccountType.CopyrightProtection,
  },
  {
    label: '国家税务局税务系统',
    value: EnterpriseAccountType.NationalTax,
  },
  {
    label: '省级科技创新平台',
    value: EnterpriseAccountType.ProvincialInnovationPlatform,
  },
  {
    label: '知识产权管理平台',
    value: EnterpriseAccountType.IntellectualPropertyPlatform,
  },
];

export const enterpriseAccountStatusOptions = [
  {
    label: '停用',
    value: EnterpriseAccountStatus.Disabled,
  },
  {
    label: '启用',
    value: EnterpriseAccountStatus.Enabled,
  },
];

const accountTypeLabelMap = new Map<number, string>(
  enterpriseAccountTypeOptions.map((item) => [item.value, item.label]),
);

const accountStatusLabelMap = new Map<number, string>(
  enterpriseAccountStatusOptions.map((item) => [item.value, item.label]),
);

export function getEnterpriseAccountTypeLabel(value?: null | number | string) {
  const nextValue = Number(value);
  return accountTypeLabelMap.get(nextValue) ?? '未知类型';
}

export function getEnterpriseAccountStatusLabel(
  value?: null | number | string,
) {
  const nextValue = Number(value);
  return accountStatusLabelMap.get(nextValue) ?? '未知状态';
}

export function getEnterpriseAccountStatusColor(
  value?: null | number | string,
) {
  return Number(value) === EnterpriseAccountStatus.Enabled ? 'success' : 'default';
}

export function formatAccountUrl(url?: null | string) {
  if (!url) {
    return '-';
  }

  return url.replace(/^https?:\/\//, '') || url;
}

export function maskPassword(value?: null | string) {
  if (!value) {
    return '未下发';
  }

  return '••••••••';
}

export function normalizeNullableText(value?: null | string) {
  const nextValue = value?.trim();
  return nextValue ? nextValue : '-';
}
