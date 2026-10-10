/** Retain backend-menu aliases without exposing routes absent from this account. */
const aliases: Record<string, string[]> = {
  ClientCompany: ['ClientCompanyProfile', 'ClientEnterprise', 'ClientCompany'],
  ClientCompanySwitch: ['ClientCompanySwitch', 'ClientSettingsCompanySwitch'],
  ClientProfile: ['ClientProfile', 'ClientSettingsAccount'],
  ClientHome: ['Dashboard', 'ClientHome'],
  ClientCompanyMaterials: ['ClientCompanyPhotos', 'ClientCompanyMaterials'],
  ClientDashboardAnalytics: ['ClientDashboardAnalytics', 'ClientDashboard'],
};
export function resolveJourneyRoute(
  router: { hasRoute: (name: string) => boolean },
  name: string,
): string | undefined {
  return (aliases[name] ?? [name]).find((candidate) =>
    router.hasRoute(candidate),
  );
}
