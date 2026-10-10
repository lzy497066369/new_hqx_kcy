import { computed, shallowRef } from 'vue';

import { getAiStatsSummary, type AiApi } from '#/api';

export function useAiStatsSummary() {
  const loading = shallowRef(false);
  const errorMessage = shallowRef('');
  const stats = shallowRef<AiApi.AiStatsSummary>();

  const successRate = computed(() => {
    const value = stats.value;
    if (!value || value.requestCount === 0) {
      return 0;
    }
    return Math.round((value.successCount / value.requestCount) * 100);
  });

  const topSceneStats = computed(() => stats.value?.sceneStats.slice(0, 5) ?? []);
  const dailyStats = computed(() => stats.value?.dailyStats ?? []);

  async function load() {
    loading.value = true;
    errorMessage.value = '';
    try {
      stats.value = await getAiStatsSummary();
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'AI 统计数据加载失败';
    } finally {
      loading.value = false;
    }
  }

  return {
    dailyStats,
    errorMessage,
    load,
    loading,
    stats,
    successRate,
    topSceneStats,
  };
}
