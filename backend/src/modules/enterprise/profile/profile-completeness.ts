export function isEnterpriseProfileIncomplete(
  profileStatus: string,
  completenessRate: number | string | null | undefined,
) {
  return profileStatus !== 'approved' || Number(completenessRate ?? 0) < 100;
}
