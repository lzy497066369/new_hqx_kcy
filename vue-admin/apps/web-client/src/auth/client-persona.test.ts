import { describe, expect, it } from 'vitest';
import { CLIENT_PERSONAS, getActiveClientPersona, hasClientPersona, isClientPersona } from './client-persona';

describe('client persona exclusivity', () => {
  it('removes the regional persona and ignores old stored selections', () => {
    expect(CLIENT_PERSONAS).toEqual(['overall', 'enterprise']);
    expect(isClientPersona('region')).toBe(false);
    window.sessionStorage.setItem('hqx-client-persona', 'region');
    expect(getActiveClientPersona()).toBe('enterprise');
    window.sessionStorage.removeItem('hqx-client-persona');
  });
  it('maps legacy enterprise owners to the enterprise-leader persona', () => {
    expect(hasClientPersona(['enterprise_owner'], 'enterprise')).toBe(true);
  });
  it('restores overall leaders without granting enterprise access', () => {
    expect(isClientPersona('overall')).toBe(true);
    expect(hasClientPersona(['global_leader'], 'overall')).toBe(true);
    expect(hasClientPersona(['global_leader'], 'enterprise')).toBe(false);
    expect(hasClientPersona(['project_teacher'], 'overall')).toBe(false);
  });
  it('rejects accounts assigned to more than one business persona', () => {
    expect(hasClientPersona(['project_teacher', 'region_leader'], 'enterprise')).toBe(false);
    expect(hasClientPersona(['enterprise_owner', 'project_teacher'], 'enterprise')).toBe(false);
    expect(hasClientPersona(['global_leader', 'project_teacher'], 'overall')).toBe(false);
    expect(hasClientPersona(['global_leader', 'enterprise_owner'], 'enterprise')).toBe(false);
    expect(hasClientPersona(['global_leader', 'region_leader'], 'overall')).toBe(false);
  });
});
