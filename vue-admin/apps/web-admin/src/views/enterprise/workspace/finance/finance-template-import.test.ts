import { describe, expect, it } from 'vitest';

import { describeFinanceTemplateImport } from './finance-template-import';

describe('finance template import', () => {
  it('uses the client finance template and reports the imported records', () => {
    expect(
      describeFinanceTemplateImport({
        errorCount: 0,
        importSummary: { financialCount: 2, taxAuditCount: 1 },
        status: 'valid',
      }),
    ).toEqual({
      description: '已写入 3 条记录，其中财务数据 2 条，纳税审计 1 条。',
      templateId: 'finance-info',
      title: '财税数据导入成功',
    });
  });

  it('marks partial imports for error-detail review', () => {
    expect(
      describeFinanceTemplateImport({
        errorCount: 1,
        importSummary: { financialCount: 1, taxAuditCount: 0 },
        status: 'partial',
      }).title,
    ).toBe('财税数据部分导入成功');
  });
});
