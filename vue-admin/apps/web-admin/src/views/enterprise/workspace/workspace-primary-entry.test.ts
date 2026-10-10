import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, 'index.vue'), 'utf8');

describe('enterprise workspace primary entries', () => {
  it('opens material maintenance through the enterprise material ledger', () => {
    expect(source).toContain("name: 'EnterpriseMaterialSection'");
    expect(source).toContain("openMaterialLedger('basic')");
    expect(source).toContain("openMaterialLedger('finance')");
    expect(source).toContain("openMaterialLedger('employee')");
    expect(source).toContain("openMaterialLedger('intellectual_property')");
    expect(source).toContain("openMaterialLedger('contract')");
  });

  it('opens declarations through the enterprise declaration management list', () => {
    expect(source).toContain("name: 'EnterpriseDeclarationList'");
  });
});
