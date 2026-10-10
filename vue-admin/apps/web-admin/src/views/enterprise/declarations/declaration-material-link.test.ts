import { describe, expect, it } from 'vitest';

import { getDeclarationMaterialTarget } from './declaration-material-link';

describe('declaration material links', () => {
  it.each([
    ['finance', 'finance'],
    ['employee', 'employee'],
    ['property', 'intellectual_property'],
    ['contract', 'contract'],
    ['document', 'document'],
    ['certificate', 'certificate'],
    ['photo', 'photo'],
    ['account', 'account'],
    ['basic', 'basic'],
  ])('maps %s material checks to the %s ledger section', (moduleKey, section) => {
    expect(getDeclarationMaterialTarget({ moduleKey })).toEqual({ section });
  });

  it('returns no target for a check without a known material module', () => {
    expect(getDeclarationMaterialTarget({ moduleKey: 'unknown' })).toBeUndefined();
    expect(getDeclarationMaterialTarget({})).toBeUndefined();
  });

  it('retains the material tab when the target section is tabbed', () => {
    expect(getDeclarationMaterialTarget({ moduleKey: 'contract', tabKey: 'invoices' })).toEqual({
      section: 'contract',
      tab: 'invoices',
    });
  });

  it.each([
    ['intellectualProperty', 'ip'],
    ['researchProject', 'rd'],
    ['productService', 'ps'],
    ['transformation', 'transformation'],
  ])('maps property tab %s to the property ledger tab %s', (tabKey, tab) => {
    expect(getDeclarationMaterialTarget({ moduleKey: 'property', tabKey })).toEqual({
      section: 'intellectual_property',
      tab,
    });
  });
});
