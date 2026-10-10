import type { MaterialSectionKey } from './materials/material-section';

export type EnterpriseActionTarget =
  | { declarationId?: string; type: 'declarations' }
  | { section: MaterialSectionKey; tab?: string; type: 'materials' };

export function getEnterpriseActionTarget(
  code: string,
): EnterpriseActionTarget | undefined {
  if (code === 'profile-status') {
    return { section: 'basic', type: 'materials' };
  }
  if (code === 'profile-completeness') {
    return { section: 'company', type: 'materials' };
  }
  if (code === 'evidence-chain-breaks' || /^(ip|rd|ps|transformation)-/u.test(code)) {
    return { section: 'intellectual_property', tab: 'evidence', type: 'materials' };
  }
  const declarationRisk = /^declaration-(?:material|rejected)-(.+)$/u.exec(code);
  if (declarationRisk) {
    return { declarationId: declarationRisk[1], type: 'declarations' };
  }
  return undefined;
}
