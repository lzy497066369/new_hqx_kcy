import { createApp, h, nextTick, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useServiceJourney } from './use-service-journey';
import type { JourneyDetail, JourneyOverview } from './journey';
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { resolve, reject, promise };
}
const overview = (enterpriseId: string, ids = ['d1']): JourneyOverview => ({
  enterpriseId,
  baseMissing: [],
  completedModules: 1,
  totalModules: 1,
  profileItems: [],
  candidateCount: 1,
  declarations: ids.map((id) => ({
    id,
    projectName: id,
    status: 'draft',
    updatedAt: '2026-09-30',
    deadline: null,
    currentNodeName: null,
    rejectedReason: null,
  })),
});
const detail: JourneyDetail = {
  materialCheck: {
    checkStatus: 'passed',
    readinessScore: 100,
    items: [{ checkStatus: 'passed' }],
  },
};
const cleanup: Array<() => void> = [];
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn());
});
async function flush() {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
}
function setup(options: Parameters<typeof useServiceJourney<string>>[0]) {
  let journey!: ReturnType<typeof useServiceJourney<string>>;
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({
    setup() {
      journey = useServiceJourney(options);
      return () => h('div');
    },
  });
  app.mount(host);
  cleanup.push(() => {
    app.unmount();
    host.remove();
  });
  return journey;
}
describe('journey async scope isolation', () => {
  it('discards a late overview from the previously selected enterprise', async () => {
    const a = deferred<{ overview: JourneyOverview; context: string }>();
    const b = deferred<{ overview: JourneyOverview; context: string }>();
    const scopeId = ref('a');
    const journey = setup({
      scopeId,
      loadOverview: (scope) => (scope === 'a' ? a.promise : b.promise),
      loadDetail: async () => detail,
    });
    scopeId.value = 'b';
    await flush();
    b.resolve({ overview: overview('b'), context: 'b' });
    await flush();
    a.resolve({ overview: overview('a'), context: 'a' });
    await flush();
    expect(journey.context.value).toBe('b');
    expect(journey.model.value?.declaration?.id).toBe('d1');
    expect(journey.loading.value).toBe(false);
  });
  it('discards a late detail after switching applications, including when it resolves with an error', async () => {
    const first = deferred<JourneyDetail>();
    const second = deferred<JourneyDetail>();
    const journey = setup({
      scopeId: ref('a'),
      loadOverview: async () => ({
        overview: overview('a', ['d1', 'd2']),
        context: 'a',
      }),
      loadDetail: (_, record) =>
        record.id === 'd1' ? first.promise : second.promise,
    });
    await flush();
    journey.selectDeclaration('d2');
    second.resolve(detail);
    await flush();
    first.reject(new Error('stale d1 error'));
    await flush();
    expect(journey.model.value?.declaration?.id).toBe('d2');
    expect(journey.model.value?.current.actionLabel).toBe('核对并提交内部审核');
    expect(journey.detailError.value).toBe('');
  });
  it('reports failed checks as unknown, never complete', async () => {
    const journey = setup({
      scopeId: ref('a'),
      loadOverview: async () => ({ overview: overview('a'), context: 'a' }),
      loadDetail: async () => {
        throw new Error('check offline');
      },
    });
    await flush();
    expect(journey.detailError.value).toBe('check offline');
    expect(
      journey.model.value?.stages.find((item) => item.key === 'materials')
        ?.status,
    ).not.toBe('complete');
  });
  it('rejects mismatched scope and allows retry without keeping stale context', async () => {
    const loadOverview = vi
      .fn()
      .mockResolvedValueOnce({ overview: overview('wrong'), context: 'wrong' })
      .mockResolvedValueOnce({ overview: overview('a'), context: 'a' });
    const journey = setup({
      scopeId: ref('a'),
      loadOverview,
      loadDetail: async () => detail,
    });
    await flush();
    expect(journey.error.value).toContain('企业上下文');
    expect(journey.model.value).toBeUndefined();
    expect(journey.context.value).toBeUndefined();
    await journey.refresh();
    await flush();
    expect(journey.error.value).toBe('');
    expect(journey.context.value).toBe('a');
  });
  it('restores a selected application on return and rejects foreign/deleted IDs', async () => {
    const preferredId = ref('d2');
    const journey = setup({
      scopeId: ref('a'),
      preferredId,
      loadOverview: async () => ({
        overview: overview('a', ['d1', 'd2']),
        context: 'a',
      }),
      loadDetail: async () => detail,
    });
    await flush();
    expect(journey.model.value?.declaration?.id).toBe('d2');
    journey.selectDeclaration('foreign');
    expect(journey.model.value?.declaration?.id).toBe('d2');
    preferredId.value = 'd1';
    await flush();
    expect(journey.model.value?.declaration?.id).toBe('d1');
    await journey.refresh();
    await flush();
    expect(journey.model.value?.declaration?.id).toBe('d1');
  });
  it('clears everything when enterprise scope disappears', async () => {
    const scopeId = ref('a');
    const journey = setup({
      scopeId,
      loadOverview: async () => ({ overview: overview('a'), context: 'a' }),
      loadDetail: async () => detail,
    });
    await flush();
    scopeId.value = '';
    await flush();
    expect(journey.model.value).toBeUndefined();
    expect(journey.context.value).toBeUndefined();
    expect(journey.loading.value).toBe(false);
  });
});
