import { describe, expect, it } from 'vitest';

import {
  archiveRecordConfigs,
  getArchiveLedgerTabs,
} from './archive-record-config';

describe('enterprise archive record configuration', () => {
  it('keeps every client contract field in the enterprise material ledger', () => {
    expect(archiveRecordConfigs.contracts.fields.map((field) => field.key)).toEqual([
      'htName',
      'htNum',
      'khName',
      'qdDate',
      'htMoney',
      'htStatus',
      'startDate',
      'endDate',
      'htDes',
      'htPath',
    ]);
  });

  it('keeps every client invoice field in the enterprise material ledger', () => {
    expect(archiveRecordConfigs.invoices.fields.map((field) => field.key)).toEqual([
      'fpNum',
      'htId',
      'fpDate',
      'fpMoney',
      'fpStatus',
      'zfDate',
      'remark',
      'fpPath',
    ]);
  });

  it('keeps the client document classification, status, version and attachment fields', () => {
    expect(archiveRecordConfigs.documents.fields.map((field) => field.key)).toEqual([
      'fileTitle',
      'fileClass',
      'fileStatus',
      'fileVersion',
      'fileStartDate',
      'fileRemark',
      'filePath',
    ]);
  });

  it('shows both contract and invoice tabs from the contract ledger section', () => {
    expect(getArchiveLedgerTabs('contract')).toEqual(['contracts', 'invoices']);
    expect(getArchiveLedgerTabs('document')).toEqual(['documents']);
    expect(getArchiveLedgerTabs('account')).toEqual(['accounts']);
  });

  it('keeps enterprise account passwords editable but out of the ledger table', () => {
    const passwordField = archiveRecordConfigs.accounts.fields.find(
      (field) => field.key === 'zhPassword',
    );

    expect(passwordField?.showInTable).toBe(false);
    expect(passwordField?.sensitive).toBe(true);
    expect(passwordField?.requiredOnCreate).toBe(true);
  });
});
