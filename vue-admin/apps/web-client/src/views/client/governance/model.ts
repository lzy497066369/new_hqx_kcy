import type { GovernanceEnterprise, GovernanceFilters } from '#/api/client/governance';

export const ENTERPRISE_PROJECTS = ['国家科技型技术企业', '省级科技型技术企业', '国家高新技术企业', '专精特新企业'];

export function getGovernanceImportErrorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason
    && typeof reason.message === 'string' && reason.message.trim()) {
    return reason.message;
  }
  return fallback;
}

export function filterGovernanceEnterprises(enterprises: GovernanceEnterprise[], filters: GovernanceFilters) {
  const keyword = filters.keyword?.trim() || '';
  return enterprises.filter((item) => {
    if (filters.regionId && item.regionId !== filters.regionId) return false;
    if (filters.distribution === 'assigned' && !item.projectUserId) return false;
    if (filters.distribution === 'pending' && item.projectUserId) return false;
    return !keyword || `${item.name} ${item.salesOwner} ${item.projectName} ${item.projectUsername}`.includes(keyword);
  });
}

export function saveGovernanceDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
