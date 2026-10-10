import { beforeEach, describe, expect, it } from 'vitest';

import { setActiveClientPersona } from '#/auth/client-persona';

import { getAllowedNames } from './access';

describe('client persona route access', () => {
  beforeEach(() => setActiveClientPersona('enterprise'));

  it('exposes receipts and the high-tech workflow to enterprise leaders', () => {
    const allowed = getAllowedNames();

    expect(allowed.has('Dashboard')).toBe(true);
    expect(allowed.has('ClientEnterpriseReceipts')).toBe(true);
    expect(allowed.has('ClientHighTechApplication')).toBe(true);
    expect(allowed.has('ClientHighTechSelfAssessment')).toBe(true);
    expect(allowed.has('ClientCompany')).toBe(false);
    expect(allowed.has('ClientCompanyBasic')).toBe(false);
    expect(allowed.has('ClientPolicyLibrary')).toBe(false);
    expect(allowed.has('ClientDeclaration')).toBe(false);
    expect(allowed.has('ClientMaterials')).toBe(false);
    expect(allowed.has('ClientExport')).toBe(false);
    expect(allowed.has('ClientArchive')).toBe(false);
    expect(allowed.has('ClientGovernanceOverview')).toBe(false);
  });
  it('isolates overall management and keeps hidden legacy routes accessible', () => {
    setActiveClientPersona('overall');
    expect([...getAllowedNames()]).toEqual(['Dashboard', 'ClientGovernanceOverview', 'ClientGovernanceRegions', 'ClientGovernanceAccounts', 'ClientGovernanceEnterprises']);
  });
});
