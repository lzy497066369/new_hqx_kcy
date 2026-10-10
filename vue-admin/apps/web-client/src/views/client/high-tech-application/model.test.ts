import { describe, expect, it } from 'vitest';
import {
  basicInfoErrors,
  buildMaterialContent,
  emptyDraft,
  hasPlaceholders,
  IP_SUMMARY_FIELDS,
  ipSummaryError,
  isHighTechProject,
  MATERIAL_TYPES,
  newIpItem,
  newProject,
  PROJECT_FIELDS,
  projectError,
  scoreError,
  sortIpSummaryRows,
  stepError,
  synchronizeIpNumbers,
  totalScore,
} from './model';

const filledDraft = () => {
  const draft = emptyDraft();
  draft.scores = {
    intellectualProperty: 30,
    transformation: 30,
    organization: 20,
    salesGrowth: 10,
    netAssetGrowth: 10,
  };
  const row = newProject([]);
  for (const field of PROJECT_FIELDS)
    if (field.key !== 'year') row[field.key] = `${field.label}示例`;
  row.applicationDate = '2025-01-01';
  row.authorizationDate = '2026-10-01';
  draft.projects = [row];
  return draft;
};
describe('high-tech application model', () => {
  it('permits an entire IP group to remain blank but rejects a partial group', () => {
    const row = filledDraft().projects[0]!;
    for (const key of ['ipNumber', 'ipName', 'authorizationNumber', 'applicationDate', 'authorizationDate', 'ipType', 'acquisitionMethod'] as const) row[key] = '';
    expect(projectError(row)).toBe('');
    const draft = filledDraft();
    draft.projects = [row];
    expect(buildMaterialContent('property', '公司', draft)).not.toContain('｜\n授权号：');
    row.ipName = '部分填写';
    expect(projectError(row)).toContain('对应知识产权序号');
  });
  const filledIp = () => ({
    ...newIpItem([]), name: '智能控制装置', patentType: '发明专利',
    legalStatus: '授权', patentNumber: '20260001.X', patentee: '测试企业',
    applicationDate: '2025-01-01', grantDate: '2026-01-01',
  });
  it('orders application before grant and leaves only numbering optional', () => {
    expect(IP_SUMMARY_FIELDS.map(({ label }) => label)).toEqual([
      '编号', '名称', '专利类型', '法律状态', '专利号', '专利权人', '申请日期', '授权日期',
    ]);
    expect(ipSummaryError([{ ...filledIp(), number: '' }])).toBe('');
    expect(ipSummaryError([])).toBe('');
  });
  it('sorts IP types before ascending application dates without changing records or numbering', () => {
    const rows = [
      { ...filledIp(), id: 'design', number: 'IP01', patentType: '外观设计', applicationDate: '2020-01-01' },
      { ...filledIp(), id: 'software-late', patentType: '软件著作权', applicationDate: '2024-06-01' },
      { ...filledIp(), id: 'invention-late', applicationDate: '2025-06-01', grantDate: '2025-06-02' },
      { ...filledIp(), id: 'utility-late', patentType: '实用新型', applicationDate: '2023-06-01' },
      { ...filledIp(), id: 'invention-early', applicationDate: '2023-01-01', grantDate: '2026-01-01' },
      { ...filledIp(), id: 'software-early', patentType: '软件著作权', applicationDate: '2022-01-01' },
      { ...filledIp(), id: 'utility-early', patentType: '实用新型', applicationDate: '2021-01-01' },
    ];
    const before = structuredClone(rows);
    const sorted = sortIpSummaryRows(rows);
    expect(sorted.map(({ id }) => id)).toEqual([
      'invention-early', 'invention-late', 'utility-early', 'utility-late',
      'software-early', 'software-late', 'design',
    ]);
    expect(rows).toEqual(before);
    expect(sorted.at(-1)).toBe(rows[0]);
    expect(sorted.at(-1)?.number).toBe('IP01');
  });
  it('keeps equal dates stable and places missing or invalid dates last within their type', () => {
    const rows = [
      { ...filledIp(), id: 'empty', applicationDate: '', grantDate: '2020-01-01' },
      { ...filledIp(), id: 'same-z', applicationDate: '2025-01-01' },
      { ...filledIp(), id: 'invalid', applicationDate: '2025-02-30' },
      { ...filledIp(), id: 'blank', applicationDate: '   ' },
      { ...filledIp(), id: 'same-a', applicationDate: ' 2025-01-01 ' },
      { ...filledIp(), id: 'utility', patentType: '实用新型', applicationDate: '2020-01-01' },
      { ...filledIp(), id: 'unknown', patentType: '' },
    ];
    expect(sortIpSummaryRows(rows).map(({ id }) => id)).toEqual([
      'same-z', 'same-a', 'empty', 'invalid', 'blank', 'utility', 'unknown',
    ]);
    expect(sortIpSummaryRows([])).toEqual([]);
  });
  it('renumbers sorted rows and updates project references simultaneously without cascading replacements', () => {
    const draft = emptyDraft();
    draft.ipSummary = [
      { ...filledIp(), id: 'design', number: 'IP01', patentType: '外观设计' },
      { ...filledIp(), id: 'late', number: 'IP02', applicationDate: '2025-01-01' },
      { ...filledIp(), id: 'early', number: 'IP03', applicationDate: '2023-01-01' },
    ];
    draft.projects[0]!.ipNumber = 'IP01、IP02，IP03; IP01；IP99';
    draft.projects[1]!.ipNumber = 'IP010';
    synchronizeIpNumbers(draft);
    expect(draft.ipSummary.map(({ id, number }) => [id, number])).toEqual([
      ['early', 'IP01'], ['late', 'IP02'], ['design', 'IP03'],
    ]);
    expect(draft.projects[0]!.ipNumber).toBe('IP03、IP02，IP01; IP03；IP99');
    expect(draft.projects[1]!.ipNumber).toBe('IP010');
    const normalized = structuredClone(draft);
    synchronizeIpNumbers(draft);
    expect(draft).toEqual(normalized);
  });
  it('does not guess project mappings for blank or duplicate legacy numbers', () => {
    const draft = emptyDraft();
    draft.ipSummary = [
      { ...filledIp(), id: 'design', number: 'duplicate', patentType: '外观设计' },
      { ...filledIp(), id: 'early', number: 'duplicate', applicationDate: '2023-01-01' },
      { ...filledIp(), id: 'blank', number: '' },
      { ...filledIp(), id: 'utility', number: ' 17 ', patentType: '实用新型' },
    ];
    draft.projects[0]!.ipNumber = 'duplicate,17';
    synchronizeIpNumbers(draft);
    expect(draft.ipSummary.map(({ number }) => number)).toEqual(['IP01', 'IP02', 'IP03', 'IP04']);
    expect(draft.projects[0]!.ipNumber).toBe('duplicate,IP03');
  });
  it('keeps consecutive identifiers beyond IP99', () => {
    const draft = emptyDraft();
    draft.ipSummary = Array.from({ length: 200 }, (_, index) => ({ ...filledIp(), id: `row-${index}`, number: '' }));
    synchronizeIpNumbers(draft);
    expect(draft.ipSummary[98]!.number).toBe('IP99');
    expect(draft.ipSummary[99]!.number).toBe('IP100');
    expect(draft.ipSummary[199]!.number).toBe('IP200');
  });
  it.each(IP_SUMMARY_FIELDS.filter(({ key }) => key !== 'number'))(
    'requires $label including dates and rejects whitespace-only values',
    ({ key, label }) => {
      for (const value of ['', '   ']) {
        expect(ipSummaryError([filledIp(), { ...filledIp(), [key]: value }]))
          .toBe(`第2行：请填写${label}`);
      }
    },
  );
  it('validates both calendar dates and their chronological order', () => {
    expect(ipSummaryError([{ ...filledIp(), applicationDate: '2025-02-30' }])).toContain('申请日期不正确');
    expect(ipSummaryError([{ ...filledIp(), grantDate: '2026-02-30' }])).toContain('授权日期不正确');
    expect(ipSummaryError([{ ...filledIp(), grantDate: '2024-01-01' }])).toContain('授权日期不得早于申请日期');
    expect(ipSummaryError([{ ...filledIp(), grantDate: '2025-01-01' }])).toBe('');
  });
  it('defaults to nine RDs with two branches each across the previous three Beijing calendar years', () => {
    const draft = emptyDraft(new Date('2026-10-01T04:00:00Z'));
    expect(
      draft.projects.map(({ rdNumber, year }) => ({ rdNumber, year })),
    ).toEqual([
      { rdNumber: 'RD01', year: 2023 },
      { rdNumber: 'RD02', year: 2023 },
      { rdNumber: 'RD03', year: 2023 },
      { rdNumber: 'RD04', year: 2024 },
      { rdNumber: 'RD05', year: 2024 },
      { rdNumber: 'RD06', year: 2024 },
      { rdNumber: 'RD07', year: 2025 },
      { rdNumber: 'RD08', year: 2025 },
      { rdNumber: 'RD09', year: 2025 },
    ].flatMap((row) => [row, row]));
    expect(new Set(draft.projects.map(({ id }) => id)).size).toBe(18);
    for (const row of draft.projects)
      for (const { key } of PROJECT_FIELDS)
        if (!['rdNumber', 'year', 'researchPeriod', 'achievementNumber'].includes(key)) expect(row[key]).toBe('');
    expect(draft.projects.map(({ researchPeriod }) => researchPeriod)).toEqual([
      '2023-01-01—2023-08-31', '2023-03-01—2023-10-31', '2023-05-01—2023-12-31',
      '2024-01-01—2024-08-31', '2024-03-01—2024-10-31', '2024-05-01—2024-12-31',
      '2025-01-01—2025-08-31', '2025-03-01—2025-10-31', '2025-05-01—2025-12-31',
    ].flatMap((period) => [period, period]));
    const another = emptyDraft(new Date('2026-10-01T04:00:00Z'));
    expect(
      new Set([...draft.projects, ...another.projects].map(({ id }) => id)).size,
    ).toBe(36);
    expect(newProject(draft.projects).rdNumber).toBe('RD10');
    expect(draft.projects.map((row) => row.achievementNumber)).toEqual(Array.from({ length: 18 }, (_, index) => `成果${String(index + 1).padStart(2, '0')}`));
  });
  it.each([
    ['2025-12-31T15:59:59.999Z', 2022],
    ['2025-12-31T16:00:00.000Z', 2023],
    ['2026-12-31T15:59:59.999Z', 2023],
    ['2026-12-31T16:00:00.000Z', 2024],
  ])(
    'uses the Beijing year at %s regardless of the local timezone',
    (now, firstYear) => {
      expect(emptyDraft(new Date(now)).projects.map(({ year }) => year)).toEqual([
        firstYear,
        firstYear,
        firstYear,
        firstYear + 1,
        firstYear + 1,
        firstYear + 1,
        firstYear + 2,
        firstYear + 2,
        firstYear + 2,
      ].flatMap((year) => [year, year]));
    },
  );
  it('recognizes assigned high-tech project names without making other projects clickable', () => {
    expect(isHighTechProject('国家高新技术企业')).toBe(true);
    expect(isHighTechProject('高新技术企业')).toBe(true);
    expect(isHighTechProject('专精特新企业')).toBe(false);
  });
  it('starts unscored and counts the four categories as 30 + 30 + 20 + (10 + 10)', () => {
    expect(stepError(emptyDraft(), 1)).toBe('');
    expect(totalScore(emptyDraft().scores)).toBe(0);
    expect(scoreError(emptyDraft().scores)).toContain('知识产权');
    expect(totalScore(filledDraft().scores)).toBe(100);
    const zero = filledDraft();
    Object.keys(zero.scores).forEach((key) => {
      zero.scores[key as keyof typeof zero.scores] = 0;
    });
    expect(scoreError(zero.scores)).toBe('');
  });
  it('enforces score bounds including each growth subcategory', () => {
    const draft = filledDraft();
    draft.scores.netAssetGrowth = 11;
    expect(scoreError(draft.scores)).toContain('净资产增长率');
    draft.scores.netAssetGrowth = -1;
    expect(scoreError(draft.scores)).not.toBe('');
    draft.scores.netAssetGrowth = Number.NaN;
    expect(scoreError(draft.scores)).not.toBe('');
  });
  it('preserves all fifteen detail columns and validates before materials', () => {
    expect(PROJECT_FIELDS).toHaveLength(15);
    const keys = PROJECT_FIELDS.map(({ key }) => key);
    expect(keys.indexOf('applicationDate') + 1).toBe(keys.indexOf('authorizationDate'));
    const draft = filledDraft();
    expect(stepError(draft, 2)).toBe('');
    draft.projects[0]!.psNumber = '';
    expect(stepError(draft, 2)).toContain('对应PS');
    expect(stepError(draft, 1)).toBe('');
    draft.projects = [];
    expect(stepError(draft, 2)).toContain('至少');
  });
  it('rejects invalid calendar dates', () => {
    const draft = filledDraft();
    draft.projects[0]!.authorizationDate = '2026-02-30';
    expect(stepError(draft, 2)).toContain('授权日期');
  });
  it('validates project application dates while accepting legacy missing dates', () => {
    const row = filledDraft().projects[0]!;
    expect(projectError({ ...row, applicationDate: '2025-02-30' })).toContain('申请日期');
    expect(projectError({ ...row, applicationDate: '2026-10-02' })).toContain('不得早于');
    const legacy = { ...row };
    Reflect.deleteProperty(legacy, 'applicationDate');
    expect(projectError(legacy)).toBe('');
    for (const key of ['ipNumber', 'ipName', 'authorizationNumber', 'authorizationDate', 'ipType', 'acquisitionMethod'] as const) legacy[key] = '';
    expect(projectError(legacy)).toBe('');
  });
  it('uses non-colliding row identifiers after deletion', () => {
    const one = newProject([]);
    const two = newProject([one]);
    const replacement = newProject([two]);
    expect(new Set([one.id, two.id, replacement.id]).size).toBe(3);
    expect(replacement.rdNumber).not.toBe(two.rdNumber);
  });
  it('generates editable outlines only from entered facts, with missing information explicit', () => {
    const draft = filledDraft();
    for (const type of MATERIAL_TYPES) {
      const content = buildMaterialContent(type.key, '测试企业', draft);
      expect(content).toContain('测试企业');
      expect(content).toContain(type.title);
      expect(hasPlaceholders(content)).toBe(true);
      expect(content).not.toContain('undefined');
    }
    expect(buildMaterialContent('property', '测试企业', draft)).toContain(
      draft.projects[0]!.authorizationNumber,
    );
  });
});

describe('enterprise basic information validation', () => {
  it('allows empty drafts and preserves zero and no R&D expenses', () => {
    const draft = emptyDraft();
    expect(basicInfoErrors(draft.basicInfo)).toEqual({});
    expect(stepError(draft, 0)).toBe('');
    for (const key of Object.keys(draft.basicInfo)) {
      Object.assign(draft.basicInfo, { [key]: key === 'hasRdExpenses' ? false : 0 });
    }
    expect(basicInfoErrors(draft.basicInfo)).toEqual({});
  });
  it.each(['employeeCount', 'insuredEmployeeCount', 'patentCount', 'inventionPatentCount', 'utilityModelCount', 'softwareCopyrightCount'])('rejects invalid counts for %s', (key) => {
    for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const draft = emptyDraft();
      Object.assign(draft.basicInfo, { [key]: value });
      expect(Object.keys(basicInfoErrors(draft.basicInfo))).toContain(key);
      expect(stepError(draft, 0)).not.toBe('');
    }
  });
  it('rejects inconsistent staffing and accepts decimal sales revenue', () => {
    const draft = emptyDraft();
    Object.assign(draft.basicInfo, { salesRevenue: 123.45, employeeCount: 10, insuredEmployeeCount: 11 });
    expect(stepError(draft, 0)).toContain('不能超过');
    draft.basicInfo.insuredEmployeeCount = 10;
    expect(stepError(draft, 0)).toBe('');
    draft.basicInfo.salesRevenue = -0.01;
    expect(stepError(draft, 0)).toContain('企业销售额');
  });
});
