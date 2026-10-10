import { requestClient } from '#/api/request';

export namespace AdminDashboardApi {
  export interface MetricCard {
    hint: string;
    key: string;
    label: string;
    value: number | string;
  }

  export interface CountItem {
    label: string;
    value: number;
  }

  export interface ActivityTrendItem {
    failed: number;
    label: string;
    success: number;
    value: number;
  }

  export interface EnterpriseRow {
    completenessRate: number;
    declarationCount: number;
    id: string;
    industry: null | string;
    name: string;
    profileStatus: string;
    status: number;
    updateTime: string;
  }

  export interface TodoItem {
    actionText: string;
    description: string;
    key: string;
    priority: 'high' | 'medium' | 'low';
    routePath: string;
    source: string;
    title: string;
  }

  export interface NotificationItem {
    actionPath: string;
    actionText: string;
    content: string;
    id: string;
    level: 'high' | 'medium' | 'low';
    status: 'read' | 'unread';
    time: string;
    title: string;
  }

  export interface SyncItem {
    actionPath: string;
    actionText: string;
    currentStep: null | string;
    description: string;
    id: string;
    jobId: string;
    progress: number;
    runId: string;
    status: string;
    time: string;
    title: string;
  }

  export interface WorkProgressItem {
    key: string;
    label: string;
    percent: number;
    value: string;
  }

  export interface QuickEntry {
    icon: string;
    label: string;
    path: string;
  }

  export interface Analytics {
    activityTrend: ActivityTrendItem[];
    declarationStatusStats: CountItem[];
    enterpriseTrend: CountItem[];
    overview: MetricCard[];
    policyStatusStats: CountItem[];
    profileStatusStats: CountItem[];
    tableRows: EnterpriseRow[];
  }

  export interface Workbench {
    notificationSummary: {
      description: string;
      items: NotificationItem[];
      unread: number;
    };
    overview: MetricCard[];
    policyCollectSummary: {
      changedPolicyCount: number;
      lastRun: null | {
        changedCount: number;
        createTime: string;
        currentStep: null | string;
        errorMessage: null | string;
        finishedAt: null | string;
        id: string;
        ignoredCount: number;
        jobId: string;
        jobName: string;
        newCount: number;
        progress: number;
        sameCount: number;
        searchedKeywords: unknown;
        startedAt: null | string;
        status: string;
        stepMessage: null | string;
        totalCount: number;
        uncertainCount: number;
        updateTime: string;
      };
      latestNotifications: Array<{
        content: null | string;
        createTime: string;
        id: string;
        jobId: null | string;
        readAt: null | string;
        runId: null | string;
        runItemId: null | string;
        status: string;
        targetUserId: null | string;
        title: string;
        type: string;
        updateTime: string;
      }>;
      newPolicyCount: number;
      pendingReviewCount: number;
      unreadNotificationCount: number;
      uncertainCount: number;
    };
    quickEntries: QuickEntry[];
    syncSummary: {
      description: string;
      failed: number;
      items: SyncItem[];
      running: number;
    };
    todoItems: TodoItem[];
    workProgress: WorkProgressItem[];
  }
}

async function getAdminDashboardAnalyticsApi() {
  return requestClient.get<AdminDashboardApi.Analytics>('/dashboard/admin/analytics');
}

async function getAdminDashboardWorkbenchApi() {
  return requestClient.get<AdminDashboardApi.Workbench>('/dashboard/admin/workbench');
}

export { getAdminDashboardAnalyticsApi, getAdminDashboardWorkbenchApi };
