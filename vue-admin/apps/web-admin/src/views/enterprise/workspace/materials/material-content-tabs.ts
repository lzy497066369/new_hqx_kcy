import type { ArchiveTab } from './material-section';

export const materialArchiveTabs: Record<
  'account' | 'contract' | 'document',
  readonly ArchiveTab[]
> = {
  account: ['accounts'],
  contract: ['contracts', 'invoices'],
  document: ['documents'],
};
