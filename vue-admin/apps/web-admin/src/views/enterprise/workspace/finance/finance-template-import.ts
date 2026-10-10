export const financeTemplateId = 'finance-info';

interface FinanceTemplateImportRecord {
  errorCount?: number;
  importSummary?: null | Record<string, unknown>;
  status: string;
}

export function describeFinanceTemplateImport(record: FinanceTemplateImportRecord) {
  const financialCount = Number(record.importSummary?.financialCount ?? 0);
  const taxAuditCount = Number(record.importSummary?.taxAuditCount ?? 0);
  const title =
    record.status === 'valid'
      ? '财税数据导入成功'
      : record.status === 'partial'
        ? '财税数据部分导入成功'
        : '财税数据导入失败';

  return {
    description: `已写入 ${financialCount + taxAuditCount} 条记录，其中财务数据 ${financialCount} 条，纳税审计 ${taxAuditCount} 条。`,
    templateId: financeTemplateId,
    title,
  };
}
