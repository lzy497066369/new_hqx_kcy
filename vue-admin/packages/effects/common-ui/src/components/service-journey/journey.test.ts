import { describe, expect, it } from 'vitest';
import {
  buildServiceJourney,
  getBaseProfileMissing,
  sortJourneyDeclarations,
} from './journey';
import type { JourneyDeclaration, JourneyOverview } from './journey';
const record = (
  id: string,
  status = 'draft',
  overrides: Partial<JourneyDeclaration> = {},
): JourneyDeclaration => ({
  id,
  status,
  projectName: `项目${id}`,
  deadline: null,
  updatedAt: '2026-09-30',
  rejectedReason: null,
  currentNodeName: null,
  ...overrides,
});
const overview = (
  overrides: Partial<JourneyOverview> = {},
): JourneyOverview => ({
  enterpriseId: 'e1',
  baseMissing: [],
  profileItems: [],
  completedModules: 2,
  totalModules: 2,
  candidateCount: 0,
  declarations: [],
  ...overrides,
});
const stage = (model: ReturnType<typeof buildServiceJourney>, key: string) =>
  model.stages.find((item) => item.key === key)!;
describe('progressive enterprise service journey', () => {
  it('keeps the user-facing journey to the six agreed business nodes', () => {
    expect(
      buildServiceJourney(overview({ baseMissing: ['联系人'] })).current.key,
    ).toBe('profile');
    expect(
      buildServiceJourney(overview({ completedModules: 0 })).current.key,
    ).toBe('data');
    expect(buildServiceJourney(overview()).current.key).toBe('declaration');
    const result = buildServiceJourney(overview({ candidateCount: 2 }));
    expect(result.current.key).toBe('declaration');
    expect(result.stages.map((item) => item.title)).toEqual([
      '企业建档',
      '企业资料补齐',
      '创建申报',
      '材料准备',
      '材料导出',
      '申报结果归档',
    ]);
    expect(stage(result, 'declaration').summary).toContain('2 个候选项目');
    expect(result.stages.every((item) => item.target)).toBe(true);
  });
  it('treats blank identity fields and unconfigured statistics as missing/unknown', () => {
    expect(
      getBaseProfileMissing({
        name: ' ',
        creditCode: '1',
        contactName: null,
        contactPhone: '',
      }),
    ).toHaveLength(3);
    expect(
      stage(buildServiceJourney(overview({ totalModules: 0 })), 'data').status,
    ).toBe('unknown');
  });
  it('prefers returned applications beyond the recent-five list, then urgent active records', () => {
    const declarations = Array.from({ length: 6 }, (_, index) =>
      record(`${index}`, 'completed'),
    );
    declarations.push(
      record('old-return', 'rejected', { rejectedReason: '缺少审计报告' }),
    );
    const result = buildServiceJourney(
      overview({ declarations, completedModules: 0 }),
    );
    expect(result.declaration?.id).toBe('old-return');
    expect(result.current.key).toBe('materials');
    expect(result.current.gaps[0]?.description).toBe('缺少审计报告');
    expect(result.current.target.declarationId).toBe('old-return');
    expect(
      sortJourneyDeclarations([
        record('later', 'draft', { deadline: '2026-10-30' }),
        record('urgent', 'preparing', { deadline: '2026-10-01' }),
      ])[0]?.id,
    ).toBe('urgent');
  });
  it('keeps each application independent and permits manually selecting a different one', () => {
    const result = buildServiceJourney(
      overview({
        declarations: [
          record('returned', 'rejected'),
          record('in-review', 'reviewing'),
        ],
      }),
      'in-review',
    );
    expect(result.declaration?.id).toBe('in-review');
    expect(result.current.key).toBe('materials');
    expect(result.current.status).toBe('current');
    expect(result.returnedCount).toBe(1);
    expect(
      result.stages
        .filter((item) => item.target.declarationId)
        .every((item) => item.target.declarationId === 'in-review'),
    ).toBe(true);
  });
  it('never fabricates material completion from a draft or a reviewing status', () => {
    for (const status of ['draft', 'reviewing']) {
      const result = buildServiceJourney(
        overview({ declarations: [record('1', status)] }),
      );
      expect(stage(result, 'materials').status).not.toBe('complete');
    }
    const empty = buildServiceJourney(
      overview({ declarations: [record('1')] }),
      '1',
      {
        materialCheck: {
          checkStatus: 'passed',
          readinessScore: 100,
          items: [],
        },
      },
    );
    expect(stage(empty, 'materials').status).toBe('attention');
  });
  it('shows live material and qualification gaps rather than global profile readiness', () => {
    const result = buildServiceJourney(
      overview({ declarations: [record('1')] }),
      '1',
      {
        materialCheck: {
          checkStatus: 'partial',
          readinessScore: 60,
          items: [
            {
              checkStatus: 'missing',
              itemName: '年度报告',
              moduleKey: 'finance',
              tabKey: 'financial',
              missingFields: ['附件'],
            },
          ],
        },
        qualification: { status: 'ineligible', missing: ['收入门槛未满足'] },
      },
    );
    expect(result.current.key).toBe('materials');
    expect(result.current.gaps.map((item) => item.title)).toEqual([
      '收入门槛未满足',
      '年度报告',
    ]);
    expect(result.current.target.declarationId).toBe('1');
  });
  it('offers review after passed materials without automatically submitting', () => {
    const result = buildServiceJourney(
      overview({ declarations: [record('1')] }),
      '1',
      {
        materialCheck: {
          checkStatus: 'passed',
          readinessScore: 100,
          items: [{ checkStatus: 'passed' }],
        },
      },
    );
    expect(result.current.actionLabel).toBe('核对并提交内部审核');
    expect(result.current.target).toEqual({
      stage: 'materials',
      declarationId: '1',
    });
  });
  it.each(['approved', 'completed', 'cancelled'])(
    'does not label %s as government-approved or archived',
    (status) => {
      const result = buildServiceJourney(
        overview({ declarations: [record('1', status)] }),
      );
      expect(result.current.key).toBe('results');
      expect(result.current.status).not.toBe('complete');
      expect(result.current.description).toContain('不能自动标记为已归档');
      if (status === 'cancelled')
        expect(stage(result, 'materials').status).not.toBe('complete');
    },
  );
  it('keeps an unknown application status actionable instead of creating another draft', () => {
    const result = buildServiceJourney(
      overview({ declarations: [record('1', 'unexpected')] }),
    );
    expect(result.current.status).toBe('unknown');
    expect(result.current.target.declarationId).toBe('1');
  });
  it('ignores invalid dates and never shows a historic deadline as a current reminder', () => {
    expect(
      buildServiceJourney(
        overview({
          declarations: [record('1', 'draft', { deadline: 'invalid' })],
        }),
      ).deadlineText,
    ).toBeUndefined();
    expect(
      buildServiceJourney(
        overview({
          declarations: [record('1', 'completed', { deadline: '2026-01-01' })],
        }),
      ).deadlineText,
    ).toBeUndefined();
    expect(
      buildServiceJourney(
        overview({
          declarations: [record('1', 'draft', { deadline: '2026-09-30' })],
        }),
        '1',
        undefined,
        new Date('2026-09-29T12:00:00'),
      ).deadlineText,
    ).toContain('截止');
  });
});
