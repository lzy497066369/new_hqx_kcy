import { requestClient } from '#/api/request';

export namespace ClientDashboardApi {
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

  export interface Company {
    creditCode: string;
    id: string;
    industry: null | string;
    name: string;
    profileStatus: string;
    shortName: null | string;
    status: number;
  }

  export interface QuickEntry {
    icon: string;
    label: string;
    path: string;
  }

  export interface WorkProgressItem {
    key: string;
    label: string;
    percent: number;
    value: string;
  }

  export interface TodoItem {
    actionText: string;
    category: 'declaration' | 'material' | 'profile';
    description: string;
    key: string;
    moduleKey?: string;
    priority: 'high' | 'medium' | 'low';
    priorityReason?: string;
    routePath: string;
    source: string;
    tabKey?: string;
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
    progress: number;
    status: string;
    time: string;
    title: string;
  }

  export interface ProfileItem {
    attachmentCount: number;
    isCompleted: boolean;
    itemName: string;
    missingFields: string[];
    moduleKey: string;
    moduleName: string;
    recordCount: number;
    requiredMinCount: number;
    score: number;
    summary: null | string;
    tabKey: string;
  }

  export interface ProfileStat {
    attachmentRecords: number;
    calculatedAt: null | string;
    completedModules: number;
    completenessRate: number;
    enterpriseId: null | string;
    healthScore: number;
    highTechReadiness: {
      gaps: Array<{
        actionText: string;
        blocking: boolean;
        description: string;
        itemName: string;
        moduleKey: string;
        tabKey: string;
      }>;
      readinessRate: number;
      readyItems: number;
      status: 'high_risk' | 'needs_completion' | 'ready';
      summary: string;
      totalItems: number;
    };
    items: ProfileItem[];
    missingModules: Array<{ key: string; name: string }>;
    totalModules: number;
    totalRecords: number;
  }

  export interface FinanceTrendItem {
    highTechIncome: number;
    netAssets: number;
    netProfit: number;
    rdExpense: number;
    revenue: number;
    year: string;
  }

  export interface EmployeeStats {
    activeTotal: number;
    educationStats: CountItem[];
    rdStaffTotal: number;
    titleStats: CountItem[];
    total: number;
  }

  export interface DeclarationItem {
    companyId: string;
    currentNodeName: null | string;
    deadline: null | string;
    declarationNo: string;
    id: string;
    missingMaterialCount: number;
    policyType: null | string;
    progress: number;
    projectId: string;
    projectName: string;
    rejectedReason: null | string;
    status: string;
    submitTime: null | string;
    updateTime: string;
  }

  export interface Analytics {
    company: Company;
    declarationStats: CountItem[];
    employeeStats: EmployeeStats;
    financeGrowthTrend: FinanceTrendItem[];
    materialStats: CountItem[];
    overview: MetricCard[];
    profileItems: ProfileItem[];
    profileStat: ProfileStat;
    propertyStats: CountItem[];
    recentDeclarations: DeclarationItem[];
  }

  export interface Workbench {
    company: Company;
    notificationSummary: {
      description: string;
      items: NotificationItem[];
      unread: number;
    };
    overview: MetricCard[];
    quickEntries: QuickEntry[];
    syncSummary: {
      description: string;
      failed: number;
      items: SyncItem[];
      running: number;
    };
    todoPreview: TodoItem[];
    workProgress: WorkProgressItem[];
  }

  export interface Todos {
    company: Company;
    items: TodoItem[];
    summary: {
      all: number;
      declaration: number;
      high: number;
      material: number;
      profile: number;
    };
  }
}

async function getClientDashboardAnalyticsApi() {
  return requestClient.get<ClientDashboardApi.Analytics>('/dashboard/client/analytics');
}

async function getClientDashboardWorkbenchApi() {
  return requestClient.get<ClientDashboardApi.Workbench>('/dashboard/client/workbench');
}

async function getClientDashboardTodosApi() {
  return requestClient.get<ClientDashboardApi.Todos>('/dashboard/client/todos');
}

export {
  getClientDashboardAnalyticsApi,
  getClientDashboardTodosApi,
  getClientDashboardWorkbenchApi,
};
