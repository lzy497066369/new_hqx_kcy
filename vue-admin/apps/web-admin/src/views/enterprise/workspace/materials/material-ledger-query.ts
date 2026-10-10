const ledgerSectionTabs: Readonly<Record<string, readonly string[]>> = {
  account: ['accounts'],
  contract: ['contracts', 'invoices'],
  document: ['documents'],
  finance: ['financial', 'taxAudit'],
  intellectual_property: ['evidence', 'ip', 'ps', 'rd', 'transformation'],
};

export function resolveMaterialLedgerTab(section: string, tab?: string) {
  return tab && ledgerSectionTabs[section]?.includes(tab) ? tab : undefined;
}
