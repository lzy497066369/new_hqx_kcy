import { describe, expect, it } from 'vitest';
import { resolveJourneyRoute } from './journey-navigation';
const router = (...names: string[]) => ({
  hasRoute: (name: string) => names.includes(name),
});
describe('journey menu compatibility', () => {
  it('uses the company-profile page instead of a catalog with the same legacy name', () => {
    expect(
      resolveJourneyRoute(
        router('ClientCompany', 'ClientCompanyProfile'),
        'ClientCompany',
      ),
    ).toBe('ClientCompanyProfile');
  });
  it('supports the static enterprise profile route', () => {
    expect(resolveJourneyRoute(router('ClientCompany'), 'ClientCompany')).toBe(
      'ClientCompany',
    );
  });
  it('preserves old settings menu names', () => {
    expect(
      resolveJourneyRoute(
        router('ClientSettingsCompanySwitch'),
        'ClientCompanySwitch',
      ),
    ).toBe('ClientSettingsCompanySwitch');
    expect(
      resolveJourneyRoute(router('ClientSettingsAccount'), 'ClientProfile'),
    ).toBe('ClientSettingsAccount');
  });
  it('does not invent navigation for inaccessible menus', () => {
    expect(
      resolveJourneyRoute(router(), 'ClientMyProjectDetail'),
    ).toBeUndefined();
  });
  it('prefers the new dashboard route while keeping legacy home aliases', () => {
    expect(resolveJourneyRoute(router('Dashboard', 'ClientHome'), 'ClientHome')).toBe(
      'Dashboard',
    );
  });

  it('returns to the legacy named home entry', () => {
    expect(resolveJourneyRoute(router('ClientHome'), 'ClientHome')).toBe(
      'ClientHome',
    );
  });
});
