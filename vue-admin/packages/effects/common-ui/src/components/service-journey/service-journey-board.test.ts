import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { buildServiceJourney } from './journey';
import ServiceJourneyBoard from './service-journey-board.vue';
const model = buildServiceJourney({
  enterpriseId: 'e1',
  baseMissing: [],
  profileItems: [],
  totalModules: 2,
  completedModules: 1,
  candidateCount: 2,
  declarations: [
    {
      id: 'returned',
      status: 'rejected',
      projectName: '项目甲',
      deadline: null,
      updatedAt: '2026-09-30',
      rejectedReason: '请补审计报告',
      currentNodeName: null,
    },
    {
      id: 'review',
      status: 'reviewing',
      projectName: '项目乙',
      deadline: null,
      updatedAt: '2026-09-30',
      rejectedReason: null,
      currentNodeName: '项目老师审核',
    },
  ],
});
function button(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper
    .findAll('button')
    .find((element) => element.text().includes(text))!;
}
describe('journey board interactions', () => {
  it('does not offer manual refresh while idle or loading', () => {
    for (const loading of [false, true]) {
      const wrapper = mount(ServiceJourneyBoard, { props: { model, loading } });
      expect(wrapper.findAll('button').some((item) => item.text().includes('刷新'))).toBe(false);
      expect(wrapper.attributes('aria-busy')).toBe(String(loading));
      wrapper.unmount();
    }
  });
  it('exposes seven ordered steps, one current stage and a scoped primary action', async () => {
    const wrapper = mount(ServiceJourneyBoard, { props: { model } });
    expect(wrapper.findAll('.journey-step')).toHaveLength(7);
    expect(wrapper.findAll('[aria-current="step"]')).toHaveLength(1);
    expect(wrapper.text()).toContain('请补审计报告');
    await button(wrapper, '查看退回原因并补正').trigger('click');
    expect(wrapper.emitted('navigate')?.[0]?.[0]).toEqual({
      stage: 'review',
      declarationId: 'returned',
    });
  });
  it('allows browsing later stages without marking them complete or changing the recommendation', async () => {
    const wrapper = mount(ServiceJourneyBoard, { props: { model } });
    await wrapper.findAll('.journey-step')[6]!.trigger('click');
    expect(
      wrapper.findAll('.journey-step')[6]!.attributes('aria-expanded'),
    ).toBe('true');
    expect(wrapper.text()).toContain('不能自动标记为已归档');
    await button(wrapper, '查看历史记录与结果').trigger('click');
    expect(wrapper.emitted('navigate')?.[0]?.[0]).toEqual({
      stage: 'results',
      declarationId: 'returned',
    });
    expect(wrapper.find('[aria-current="step"]').text()).toContain('审核补正');
  });
  it('switches the selected application and exposes remaining correction work', async () => {
    const alternate = buildServiceJourney(
      {
        enterpriseId: 'e1',
        baseMissing: [],
        profileItems: [],
        totalModules: 2,
        completedModules: 1,
        candidateCount: 2,
        declarations: model.declarations,
      },
      'review',
    );
    const wrapper = mount(ServiceJourneyBoard, { props: { model: alternate } });
    expect(wrapper.text()).toContain('另有 1 条退回申报');
    await button(wrapper, '切换至退回申报').trigger('click');
    expect(wrapper.emitted('selectDeclaration')?.[0]).toEqual(['returned']);
    await wrapper.find('select').setValue('returned');
    expect(wrapper.emitted('selectDeclaration')?.[1]).toEqual(['returned']);
  });
  it('shows retryable load errors without rendering stale business data', async () => {
    const wrapper = mount(ServiceJourneyBoard, {
      props: { model, error: '接口不可用' },
    });
    expect(wrapper.find('[role="alert"]').text()).toContain('接口不可用');
    expect(wrapper.findAll('.journey-step')).toHaveLength(0);
    await button(wrapper, '重新加载').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });
  it('distinguishes failed material checks from complete materials', async () => {
    const wrapper = mount(ServiceJourneyBoard, {
      props: { model, detailError: '核验失败' },
    });
    expect(wrapper.text()).toContain('不能据此判断已齐备');
    await button(wrapper, '重试材料核验').trigger('click');
    expect(wrapper.emitted('retryDetail')).toHaveLength(1);
  });
});
