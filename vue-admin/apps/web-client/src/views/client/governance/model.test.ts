import { describe, expect, it } from 'vitest';

import { getGovernanceImportErrorMessage } from './model';

describe('governance import error messages', () => {
  const fallback = 'Recognition failed';

  it('preserves backend validation messages unwrapped by RequestClient', () => {
    expect(getGovernanceImportErrorMessage({
      code: 400,
      data: null,
      message: 'Please upload an .xlsx file no larger than 5MB',
    }, fallback)).toBe('Please upload an .xlsx file no larger than 5MB');
  });

  it('preserves network error messages', () => {
    expect(getGovernanceImportErrorMessage(new Error('Network Error'), fallback))
      .toBe('Network Error');
  });

  it.each([undefined, null, 'unexpected', {}, { message: 400 }, { message: '' }, { message: ' ' }])(
    'uses the fallback for an error without a message: %s', (reason) => {
      expect(getGovernanceImportErrorMessage(reason, fallback)).toBe(fallback);
    },
  );
});
