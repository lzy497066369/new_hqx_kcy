import { describe, expect, it } from 'vitest';

import {
  maskEmployeeIdCard,
  normalizeEmployeeIdCard,
  parseEmployeeIdCard,
} from './employee-identity';

describe('employee identity helpers', () => {
  it('normalizes and validates a Chinese ID card', () => {
    const identity = parseEmployeeIdCard(
      ' 360681199101203928 ',
      new Date(2026, 6, 29),
    );

    expect(normalizeEmployeeIdCard(' 360681199101203928 ')).toBe(
      '360681199101203928',
    );
    expect(identity).toMatchObject({ age: 35, ageRange: 2, gender: 2 });
    expect(maskEmployeeIdCard('360681199101203928')).toBe(
      '3606**********3928',
    );
  });

  it('rejects an invalid checksum', () => {
    expect(parseEmployeeIdCard('360681199101203929')).toBeNull();
  });
});
