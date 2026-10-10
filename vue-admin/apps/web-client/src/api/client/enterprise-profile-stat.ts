import { requestClient } from '#/api/request';

export namespace ClientEnterpriseProfileStatApi {
  export interface MissingModule {
    key: string;
    name: string;
  }

  export interface StatItem {
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

  export interface HighTechReadinessGap {
    actionText: string;
    blocking: boolean;
    description: string;
    itemName: string;
    moduleKey: string;
    tabKey: string;
  }

  export interface HighTechReadiness {
    gaps: HighTechReadinessGap[];
    readinessRate: number;
    readyItems: number;
    status: 'high_risk' | 'needs_completion' | 'ready';
    summary: string;
    totalItems: number;
  }

  export interface Stat {
    attachmentRecords: number;
    calculatedAt: null | string;
    completedModules: number;
    completenessRate: number;
    enterpriseId: null | string;
    healthScore: number;
    highTechReadiness: HighTechReadiness;
    items: StatItem[];
    missingModules: MissingModule[];
    totalModules: number;
    totalRecords: number;
  }
}

async function getClientEnterpriseProfileStatsApi() {
  return requestClient.get<ClientEnterpriseProfileStatApi.Stat>(
    '/client/enterprise-profile/stats',
  );
}

async function recalculateClientEnterpriseProfileStatsApi() {
  return requestClient.post<ClientEnterpriseProfileStatApi.Stat>(
    '/client/enterprise-profile/stats/recalculate',
  );
}

export {
  getClientEnterpriseProfileStatsApi,
  recalculateClientEnterpriseProfileStatsApi,
};
