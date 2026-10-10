import { beforeEach, describe, expect, it } from 'vitest';
import { resolveClientHomePath } from './client-home-path';
import { setActiveClientPersona } from './client-persona';

describe('role-specific landing pages', () => {
  beforeEach(() => setActiveClientPersona('enterprise'));
  it.each(['/', '%2F', '/home', '/client/home', '/dashboard/workspace', '%2Fdashboard%2Fworkspace', '/client/company', '/client/enterprise-receipts', undefined])('routes legacy home %s to the enterprise receipt list', (path) => {
    expect(resolveClientHomePath(path)).toBe('/client/enterprise-receipts');
  });
  it('preserves deep links and tolerates malformed encoding', () => {
    expect(resolveClientHomePath('/projects/my')).toBe('/projects/my');
    expect(resolveClientHomePath('/projects/%')).toBe('/projects/%');
  });
  it('uses the restored overall home and normalizes the other persona home', () => {
    expect(resolveClientHomePath('/governance/overview')).toBe('/client/enterprise-receipts');
    setActiveClientPersona('overall');
    for (const path of [undefined, '/', '%2F', '/home', '/client/home', '/client/enterprise-receipts', '/governance/overview']) {
      expect(resolveClientHomePath(path)).toBe('/governance/overview');
    }
    expect(resolveClientHomePath('/governance/accounts')).toBe('/governance/accounts');
  });
});
