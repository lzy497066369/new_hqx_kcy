export function resolveMaterialLedgerEnterpriseId(
  visibleEnterpriseIds: string[],
  queryEnterpriseId: string | undefined,
  contextEnterpriseId?: string,
) {
  if (visibleEnterpriseIds.includes(queryEnterpriseId ?? '')) {
    return queryEnterpriseId;
  }

  if (visibleEnterpriseIds.includes(contextEnterpriseId ?? '')) {
    return contextEnterpriseId;
  }

  return visibleEnterpriseIds[0];
}
