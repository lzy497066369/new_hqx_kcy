import { describe, expect, it } from 'vitest';
import { newProject } from './model';
import { matchesTechField, projectPatentNames, techFieldOptions } from './tech-fields';

describe('high-tech field selection', () => {
  const field = { id: 'bi', label: '一、电子信息 / （一）软件 / 9. 企业管理软件 / 数据分析与决策支持的商业智能（BI）软件' };
  it('searches every level and the full wording case-insensitively', () => {
    for (const search of ['电子信息', '（一）软件', '9. 企业管理', '数据分析', 'bi', '电子信息 BI', field.label, '']) {
      expect(matchesTechField(search, field)).toBe(true);
    }
    expect(matchesTechField('材料 BI', field)).toBe(false);
    expect(matchesTechField('软件', undefined)).toBe(false);
  });
  it('keeps all fields available without duplicate recommendation values', () => {
    const other = { id: 'other', label: '其他领域' };
    const groups = techFieldOptions([field, other], [field]);
    expect(groups[0]!.label).toBe('模型推荐');
    expect(groups.flatMap((group) => group.options).map((option) => option.value)).toEqual(['bi', 'other']);
  });
  it('trims, deduplicates and ignores empty patent names', () => {
    const rows = [' 分析软件 ', '分析软件', '', '装置'].map((ipName) => ({ ...newProject([]), ipName }));
    expect(projectPatentNames(rows)).toEqual(['分析软件', '装置']);
  });
});
