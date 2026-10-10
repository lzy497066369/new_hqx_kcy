import {
  computed,
  onActivated,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
} from 'vue';
import type { Ref } from 'vue';
import {
  buildServiceJourney,
  needsJourneyDetail,
  sortJourneyDeclarations,
} from './journey';
import type {
  JourneyDeclaration,
  JourneyDetail,
  JourneyOverview,
} from './journey';

/** Scope + sequence guards prevent another enterprise's late response becoming visible. */
export function useServiceJourney<T>(options: {
  scopeId: Readonly<Ref<string>>;
  preferredId?: Readonly<Ref<string>>;
  loadOverview: (
    scopeId: string,
  ) => Promise<{ overview: JourneyOverview; context: T }>;
  loadDetail: (
    scopeId: string,
    declaration: JourneyDeclaration,
  ) => Promise<JourneyDetail>;
}) {
  const overview = shallowRef<JourneyOverview>();
  const context = shallowRef<T>();
  const detail = shallowRef<JourneyDetail>();
  const loading = ref(false);
  const detailLoading = ref(false);
  const error = ref('');
  const detailError = ref('');
  const selectedId = ref('');
  let overviewVersion = 0;
  let detailVersion = 0;
  let activated = false;
  const model = computed(() =>
    overview.value
      ? buildServiceJourney(overview.value, selectedId.value, detail.value)
      : undefined,
  );
  function invalidate() {
    overviewVersion++;
    detailVersion++;
    overview.value = undefined;
    context.value = undefined;
    detail.value = undefined;
    error.value = '';
    detailError.value = '';
    detailLoading.value = false;
  }
  async function refreshDetail() {
    const version = ++detailVersion;
    const scope = options.scopeId.value;
    const declaration = overview.value?.declarations.find(
      (item) => item.id === selectedId.value,
    );
    detail.value = undefined;
    detailError.value = '';
    detailLoading.value = false;
    if (!declaration || !needsJourneyDetail(declaration.status)) return;
    detailLoading.value = true;
    try {
      const result = await options.loadDetail(scope, declaration);
      if (version === detailVersion && scope === options.scopeId.value)
        detail.value = result;
    } catch (cause) {
      if (version === detailVersion && scope === options.scopeId.value)
        detailError.value =
          cause instanceof Error ? cause.message : '材料核验加载失败，请重试';
    } finally {
      if (version === detailVersion) detailLoading.value = false;
    }
  }
  async function refresh() {
    const scope = options.scopeId.value;
    const preferred =
      overview.value?.enterpriseId === scope
        ? selectedId.value
        : (options.preferredId?.value ?? '');
    invalidate();
    selectedId.value = '';
    const version = overviewVersion;
    loading.value = Boolean(scope);
    if (!scope) return;
    try {
      const result = await options.loadOverview(scope);
      if (version !== overviewVersion || scope !== options.scopeId.value)
        return;
      if (result.overview.enterpriseId !== scope)
        throw new Error('企业上下文已变化，请重新加载服务进度');
      overview.value = result.overview;
      context.value = result.context;
      selectedId.value = result.overview.declarations.some(
        (item) => item.id === preferred,
      )
        ? preferred
        : (sortJourneyDeclarations(result.overview.declarations)[0]?.id ?? '');
      void refreshDetail();
    } catch (cause) {
      if (version === overviewVersion && scope === options.scopeId.value)
        error.value =
          cause instanceof Error ? cause.message : '服务进度加载失败，请重试';
    } finally {
      if (version === overviewVersion) loading.value = false;
    }
  }
  function selectDeclaration(id: string) {
    if (
      !overview.value?.declarations.some((item) => item.id === id) ||
      id === selectedId.value
    )
      return;
    selectedId.value = id;
    void refreshDetail();
  }
  if (options.preferredId)
    watch(options.preferredId, (id) => {
      if (id) selectDeclaration(id);
    });
  watch(options.scopeId, () => void refresh(), { immediate: true });
  onActivated(() => {
    if (activated) void refresh();
    activated = true;
  });
  onScopeDispose(invalidate);
  return {
    context,
    detailError,
    detailLoading,
    error,
    loading,
    model,
    refresh,
    refreshDetail,
    selectDeclaration,
  };
}
