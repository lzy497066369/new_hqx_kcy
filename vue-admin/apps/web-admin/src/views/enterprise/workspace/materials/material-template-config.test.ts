import { describe, expect, it } from 'vitest';

import { getMaterialTemplateConfig } from './material-template-config';

describe('enterprise material template configuration', () => {
  it('routes the employee roster through preview and confirmation', () => {
    expect(getMaterialTemplateConfig('employee-info')).toMatchObject({
      accept: '.xlsx,.xlsm,.xls',
      importMode: 'employee-preview',
    });
  });

  it('keeps finance and R&D templates on their client-compatible direct parsers', () => {
    expect(getMaterialTemplateConfig('finance-info')).toMatchObject({
      accept: '.csv',
      importMode: 'direct',
    });
    expect(getMaterialTemplateConfig('ip-info')).toMatchObject({
      accept: '.csv',
      importMode: 'direct',
    });
    expect(getMaterialTemplateConfig('rd-info')).toMatchObject({
      accept: '.csv',
      importMode: 'direct',
    });
    expect(getMaterialTemplateConfig('ps-info')).toMatchObject({
      accept: '.csv',
      importMode: 'direct',
    });
    expect(getMaterialTemplateConfig('transformation-info')).toMatchObject({
      accept: '.csv',
      importMode: 'direct',
    });
  });

  it('keeps the client download filenames for R&D material templates', () => {
    expect(getMaterialTemplateConfig('ip-info').fileName).toBe('知识产权模板.csv');
    expect(getMaterialTemplateConfig('rd-info').fileName).toBe('研发项目RD模板.csv');
    expect(getMaterialTemplateConfig('ps-info').fileName).toBe('高新产品PS模板.csv');
    expect(getMaterialTemplateConfig('transformation-info').fileName).toBe('成果转化模板.csv');
  });
});
