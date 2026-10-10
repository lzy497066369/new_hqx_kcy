import { describe, expect, it } from 'vitest';
import { emptyWorkspace, normalizeWorkspace, recalculateWorkspace, recalculateStaff } from './workspace';

const person = (id: string, birth: string, extra: Record<string, string> = {}) => ({
  id, name: `人员${id}`, id_no: `110101${birth}001X`, ...extra,
});

describe('人员明细自动回填', () => {
  it('保留尚未录入人员的手填数据，首次统计覆盖旧值及零值', () => {
    const w = emptyWorkspace(2026);
    w.fields = { hr_total: '99', hr_tech: '88', edu_phd: '55', hr_foreign: '2', hr_fulltime: '1' };
    w.tables.staff = [{ id: 'empty', name: '  ' }];
    recalculateWorkspace(w);
    expect(w.fields.hr_total).toBe('99');
    w.tables.staff.push(person('1', '19951231', { education: '大学本科', title: '高级工程师', is_tech: ' 是 ' }));
    recalculateWorkspace(w);
    expect(w.fields).toMatchObject({ hr_total: '1', hr_tech: '1', edu_phd: '0', edu_bachelor: '1', title_senior: '1', age_30: '1', hr_foreign: '2', hr_fulltime: '1' });
  });

  it('按上年度年末计算年龄分界，识别15位号码并排除非法日期和未来出生日期', () => {
    const w = emptyWorkspace(2026);
    w.tables.staff = ['19951231', '19940101', '19851231', '19840101', '19751231', '19740101', '20000229', '20010229', '19951301', '19950001', '20260101'].map((birth, i) => person(String(i), birth));
    w.tables.staff.push({ id: 'old-id', name: '旧号码', id_no: '110101740101001' });
    w.tables.staff.push({ id: 'invalid-id', name: '无号码', id_no: 'unknown' });
    recalculateWorkspace(w);
    expect(w.fields).toMatchObject({ hr_total: '13', age_30: '2', age_31_40: '2', age_41_50: '2', age_51: '2' });
    w.applicationYear = 2027;
    recalculateWorkspace(w);
    expect(w.fields.age_31_40).toBe('2');
    expect(w.fields.age_51).toBe('3');
  });

  it('分类统计不把未知学历、职称和科技人员标识强行归类，忽略空姓名和移除记录', () => {
    const w = emptyWorkspace(2026);
    w.tables.staff = [
      person('1', '19900101', { education: '博士研究生', title: '高级', is_tech: '是' }),
      person('2', '19900101', { education: '硕士', title: '中级职称', is_tech: '否' }),
      person('3', '19900101', { education: '本科', title: '助理工程师', is_tech: 'true' }),
      person('4', '19900101', { education: '中专', title: '高级技工', is_tech: '1' }),
      person('5', '19900101', { education: '研究生', title: '无', is_tech: '未知' }),
      person('6', '19900101', { education: '', title: '', is_tech: '' }),
      person('7', '19900101', { archived: '1', education: '博士', is_tech: '是' }),
      person('8', '19900101', { name: '', education: '博士', is_tech: '是' }),
    ];
    recalculateWorkspace(w);
    expect(w.fields).toMatchObject({ hr_total: '6', hr_tech: '3', edu_phd: '1', edu_master: '1', edu_bachelor: '1', edu_diploma: '1', title_senior: '1', title_mid: '1', title_junior: '1', title_tech: '1' });
  });

  it('重复替换不累加，保存重新打开仍覆盖旧统计，删除最后一人清零', () => {
    const w = emptyWorkspace(2026);
    w.tables.staff = [person('1', '19900101', { education: '本科', is_tech: '是' })];
    recalculateWorkspace(w);
    recalculateWorkspace(w);
    expect(w.fields.hr_total).toBe('1');
    w.fields.hr_total = '0';
    w.fields.hr_tech = '99';
    const saved = normalizeWorkspace(JSON.parse(JSON.stringify(w)));
    expect(saved.fields).toMatchObject({ hr_total: '1', hr_tech: '1', edu_bachelor: '1' });
    saved.tables.staff = [];
    recalculateWorkspace(saved);
    expect(saved.fields).toMatchObject({ hr_total: '0', hr_tech: '0', edu_bachelor: '0', age_31_40: '0' });
    expect(saved.fields.hr_tech_fulltime).toBe('1');
    // Preserve the existing consistency check when a retained category exceeds the new total.
    expect(() => normalizeWorkspace(JSON.parse(JSON.stringify(saved)))).toThrow('不能超过科技人员总数');
    saved.fields.hr_tech_fulltime = '0';
    expect(normalizeWorkspace(JSON.parse(JSON.stringify(saved))).fields.hr_total).toBe('0');
  });

  it('没有人员明细时也补齐两列默认值，总数尚未填写时在职人数保持空白', () => {
    const w = emptyWorkspace(2026);
    recalculateWorkspace(w);
    expect(w.fields.hr_fulltime).toBeUndefined();
    expect(w.fields.hr_tech_fulltime).toBeUndefined();
    for (const category of ['parttime', 'temp', 'foreign', 'returnee', 'talent_plan']) {
      expect(w.fields[`hr_${category}`]).toBe('0');
      expect(w.fields[`hr_tech_${category}`]).toBe('0');
    }
    w.fields.hr_total = '12';
    w.fields.hr_tech = '3';
    recalculateStaff(w);
    expect(w.fields).toMatchObject({ hr_fulltime: '12', hr_tech_fulltime: '3' });
  });

  it('在职默认值使用本次统计总数，仅填空值且保留零值和手工值', () => {
    const w = emptyWorkspace(2026);
    w.fields = { hr_total: '99', hr_tech: '88', hr_fulltime: ' ', hr_tech_fulltime: '', hr_parttime: '2', hr_tech_parttime: '0' };
    w.tables.staff = [person('1', '19900101', { is_tech: '是' }), person('2', '19900101')];
    recalculateWorkspace(w);
    expect(w.fields).toMatchObject({ hr_fulltime: '2', hr_tech_fulltime: '1', hr_parttime: '2', hr_tech_parttime: '0' });
    w.fields.hr_fulltime = '0';
    w.fields.hr_foreign = '1';
    w.tables.staff.push(person('3', '19900101', { is_tech: '是' }));
    recalculateWorkspace(w);
    expect(w.fields).toMatchObject({ hr_total: '3', hr_tech: '2', hr_fulltime: '0', hr_tech_fulltime: '1', hr_foreign: '1' });
    expect(() => normalizeWorkspace(JSON.parse(JSON.stringify(w)))).toThrow('不能超过对应企业职工人数');
    w.fields.hr_tech_fulltime = '0';
    const reopened = normalizeWorkspace(JSON.parse(JSON.stringify(w)));
    expect(reopened.fields).toEqual(w.fields);
  });

  it('应用空同步结果时覆盖旧值为零', () => {
    const w = emptyWorkspace(2026);
    w.fields.hr_total = '12';
    recalculateStaff(w, true);
    expect(w.fields.hr_total).toBe('0');
  });
});
