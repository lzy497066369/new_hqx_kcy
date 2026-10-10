import type { HighTechIpItem, HighTechProject } from '#/api/client/high-tech';

export const PROJECT_IP_FIELDS = ['ipNumber', 'ipName', 'authorizationNumber', 'applicationDate', 'authorizationDate', 'ipType'] as const;

export function projectIpValues(ip?: HighTechIpItem) {
  return {
    ipNumber: ip?.number ?? '',
    ipName: ip?.name ?? '',
    authorizationNumber: ip?.patentNumber ?? '',
    applicationDate: ip?.applicationDate ?? '',
    authorizationDate: ip?.grantDate ?? '',
    ipType: ip?.patentType ?? '',
  };
}

export function selectProjectIp(row: HighTechProject, items: HighTechIpItem[], number: string): boolean {
  const ip = number ? items.find((item) => item.number === number) : undefined;
  if (number && !ip) return false;
  const values = projectIpValues(ip);
  if (PROJECT_IP_FIELDS.every((key) => row[key] === values[key]) && (number || row.acquisitionMethod === '')) return false;
  Object.assign(row, values);
  if (!number) row.acquisitionMethod = '';
  return true;
}

export function normalizeProjectAcquisitionMethods(rows: HighTechProject[]): boolean {
  let changed = false;
  for (const row of rows) {
    if (!row.ipNumber.trim() && row.acquisitionMethod !== '') {
      row.acquisitionMethod = '';
      changed = true;
    }
  }
  return changed;
}

export function projectIpOptions(items: HighTechIpItem[], current = '') {
  const options = [{ value: '', label: '无', disabled: false }, ...items.filter((ip) => ip.number.trim()).map((ip) => ({
    value: ip.number, label: `${ip.number} · ${ip.name || '未填写名称'}`, disabled: false,
  }))];
  // Keep historical references visible until the user explicitly chooses a replacement.
  if (current && !options.some((option) => option.value === current))
    options.push({ value: current, label: `${current}（历史值，请重新选择）`, disabled: true });
  return options;
}
