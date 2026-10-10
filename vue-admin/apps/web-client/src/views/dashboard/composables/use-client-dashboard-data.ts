import { computed, readonly, shallowRef } from 'vue';

import {
  getClientDashboardAnalyticsApi,
  getClientDashboardTodosApi,
  getClientDashboardWorkbenchApi,
  type ClientDashboardApi,
} from '#/api/client';

export function useClientDashboardData() {
  const loading = shallowRef(false);
  const errorMessage = shallowRef('');
  const analytics = shallowRef<ClientDashboardApi.Analytics>();
  const workbench = shallowRef<ClientDashboardApi.Workbench>();
  const todos = shallowRef<ClientDashboardApi.Todos>();

  const companyName = computed(
    () =>
      analytics.value?.company.shortName ??
      analytics.value?.company.name ??
      workbench.value?.company.shortName ??
      workbench.value?.company.name ??
      todos.value?.company.shortName ??
      todos.value?.company.name ??
      '当前企业',
  );

  async function loadAnalytics() {
    await withLoading(async () => {
      analytics.value = await getClientDashboardAnalyticsApi();
    }, '企业数据看板加载失败');
  }

  async function loadWorkbench() {
    await withLoading(async () => {
      workbench.value = await getClientDashboardWorkbenchApi();
    }, '工作台数据加载失败');
  }

  async function loadTodos() {
    await withLoading(async () => {
      todos.value = await getClientDashboardTodosApi();
    }, '待办事项加载失败');
  }

  async function withLoading(action: () => Promise<void>, fallbackMessage: string) {
    loading.value = true;
    errorMessage.value = '';
    try {
      await action();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : fallbackMessage;
    } finally {
      loading.value = false;
    }
  }

  return {
    analytics: readonly(analytics),
    companyName,
    errorMessage,
    loadAnalytics,
    loadTodos,
    loadWorkbench,
    loading,
    todos: readonly(todos),
    workbench: readonly(workbench),
  };
}
