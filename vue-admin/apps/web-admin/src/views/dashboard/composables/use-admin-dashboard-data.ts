import { readonly, shallowRef } from 'vue';

import {
  getAdminDashboardAnalyticsApi,
  getAdminDashboardWorkbenchApi,
  type AdminDashboardApi,
} from '#/api';

export function useAdminDashboardData() {
  const loading = shallowRef(false);
  const errorMessage = shallowRef('');
  const analytics = shallowRef<AdminDashboardApi.Analytics>();
  const workbench = shallowRef<AdminDashboardApi.Workbench>();

  async function loadAnalytics() {
    loading.value = true;
    errorMessage.value = '';
    try {
      analytics.value = await getAdminDashboardAnalyticsApi();
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : '后台分析数据加载失败';
    } finally {
      loading.value = false;
    }
  }

  async function loadWorkbench() {
    loading.value = true;
    errorMessage.value = '';
    try {
      workbench.value = await getAdminDashboardWorkbenchApi();
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : '工作中心数据加载失败';
    } finally {
      loading.value = false;
    }
  }

  return {
    analytics: readonly(analytics),
    errorMessage,
    loadAnalytics,
    loadWorkbench,
    loading,
    workbench: readonly(workbench),
  };
}
