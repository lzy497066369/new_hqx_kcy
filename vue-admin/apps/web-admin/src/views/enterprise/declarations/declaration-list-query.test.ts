import { describe, expect, it } from 'vitest';

import {
  buildDeclarationListQuery,
  parseDeclarationListQuery,
} from './declaration-list-query';

describe('declaration list query', () => {
  it('keeps the selected enterprise in the declaration list URL', () => {
    expect(buildDeclarationListQuery({ enterpriseId: 'enterprise-a' })).toEqual({
      enterpriseId: 'enterprise-a',
    });
  });

  it('removes the enterprise filter from the URL when reset', () => {
    expect(buildDeclarationListQuery({})).toEqual({});
  });

  it('preserves list filters and pagination in the declaration URL', () => {
    expect(
      buildDeclarationListQuery({
        enterpriseId: 'enterprise-a',
        keyword: '高新技术',
        page: 3,
        pageSize: 50,
        status: 'rejected',
      }),
    ).toEqual({
      enterpriseId: 'enterprise-a',
      keyword: '高新技术',
      page: '3',
      pageSize: '50',
      status: 'rejected',
    });
  });

  it('restores valid list filters from route query values', () => {
    expect(
      parseDeclarationListQuery({
        enterpriseId: 'enterprise-a',
        keyword: '高新技术',
        page: '3',
        pageSize: '50',
        status: 'rejected',
      }),
    ).toEqual({
      enterpriseId: 'enterprise-a',
      keyword: '高新技术',
      page: 3,
      pageSize: 50,
      status: 'rejected',
    });
  });

  it('preserves material-gap and deadline filters in the declaration URL', () => {
    expect(
      buildDeclarationListQuery({
        deadlineWithinDays: 7,
        missingMaterials: true,
      }),
    ).toEqual({ deadlineWithinDays: '7', missingMaterials: '1' });

    expect(
      parseDeclarationListQuery({
        deadlineWithinDays: '7',
        missingMaterials: '1',
      }),
    ).toMatchObject({ deadlineWithinDays: 7, missingMaterials: true });
  });
});
