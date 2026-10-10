import { requestClient } from '#/api/request';

import type { ClientDeclareProjectApi } from './declare-project';

export namespace ClientDeclarationApi {
  export type SchemeScoreResult = ClientDeclareProjectApi.SchemeScoreResult;
  export type DeclarationStatus =
    | 'approved'
    | 'cancelled'
    | 'completed'
    | 'draft'
    | 'preparing'
    | 'rejected'
    | 'reviewing'
    | 'submitted';

  export interface DeclarationListParams {
    keyword?: string;
    page?: number;
    pageSize?: number;
    status?: DeclarationStatus | string;
  }

  export interface DeclarationItem {
    activeNodeNames: string[];
    appliedScheme?: null | {
      id: string;
      schemeName: string;
      version: string;
    };
    capabilities: ClientDeclareProjectApi.DeclarationCapabilities;
    companyId: string;
    currentNodeName: null | string;
    deadline: null | string;
    declarationNo: string;
    id: string;
    missingMaterialCount: number;
    matchedScheme?: null | {
      id: string;
      qualificationStatus: 'eligible' | 'ineligible';
      regionId: null | string;
      regionName: string;
      schemeName: string;
      version: string;
    };
    policyType: null | string;
    progress: number;
    projectId: string;
    projectName: string;
    rejectedReason: null | string;
    regionId: null | string;
    regionName: null | string;
    schemeId: null | string;
    schemeVersion: null | string;
    status: DeclarationStatus;
    submitTime: null | string;
    updateTime: string;
    flow?: DeclarationFlow;
    qualification?: DeclarationQualification | null;
  }

  export interface DeclarationQualification {
    missing: string[];
    status: 'eligible' | 'ineligible';
  }

  export interface DeclarationStats {
    all: number;
    approved: number;
    draft: number;
    preparing: number;
    rejected: number;
    reviewing: number;
  }

  export interface DeclarationListResult {
    items: DeclarationItem[];
    total: number;
  }

  export type DeclarationFlowEventStatus =
    | 'completed'
    | 'current'
    | 'pending'
    | 'rejected'
    | 'waiting';

  export type DeclarationFlowEventType =
    | 'audit'
    | 'material_snapshot'
    | 'replenishment'
    | 'submit';

  export interface DeclarationFlowEvent {
    description: string;
    nodeName: string;
    occurredAt: string;
    status: DeclarationFlowEventStatus;
    title: string;
    type: DeclarationFlowEventType;
  }

  export interface DeclarationFlowNode {
    description: string;
    nodeName: string;
    order: number;
    qualification: {
      missing: string[];
      presetNames: string[];
      status: 'eligible' | 'ineligible';
    };
    status: DeclarationFlowEventStatus | 'waiting';
    time: null | string;
    timeNodeDescription: string;
    timeRuleDescription: string;
  }

  export interface DeclarationMaterialSnapshotItem {
    attachmentMissing: boolean;
    checkStatus: ClientDeclareProjectApi.MaterialCheckStatus;
    itemName: string;
    matchedCount: number;
    matchedRecordIds: string[];
    missingFields: string[];
    moduleKey: string;
    moduleName: string;
    relationSummary: Record<string, string[]>;
    requiredCount: number;
    suggestion: null | string;
    tabKey: string;
    tabName: string;
  }

  export interface DeclarationReplenishment {
    reason: string;
    requestedAt: string;
    status: 'pending' | 'resolved';
  }

  export interface DeclarationFlow {
    auditNodes: DeclarationFlowNode[];
    events: DeclarationFlowEvent[];
    materialSnapshot: {
      checkedAt: null | string;
      checkId: null | string;
      items: DeclarationMaterialSnapshotItem[];
      readinessScore: number;
      source: 'declaration_snapshot' | 'latest_check';
    };
    replenishment: DeclarationReplenishment | null;
    submitRecord: null | {
      declarationNo: string;
      nodeName: string;
      submitTime: string;
    };
  }

  export interface GaoxinBookField {
    editable: boolean;
    key: string;
    label: string;
    moduleKey?: string;
    source: 'enterprise_profile' | 'supplemental';
    tabKey?: string;
    value: null | string;
  }

  export interface GaoxinBookRecord {
    fields: GaoxinBookField[];
    id: string;
    title: string;
  }

  export interface GaoxinBookSection {
    description: string;
    fields: GaoxinBookField[];
    key: string;
    records: GaoxinBookRecord[];
    title: string;
  }

  export interface GaoxinBookDraft {
    completionRate: number;
    declarationId: string;
    draftId: string;
    generatedAt: string;
    projectId: string;
    projectName: string;
    sections: GaoxinBookSection[];
    status: string;
    supplemental: Record<string, string>;
  }

  export type GaoxinExportReadinessIssueLevel = 'error' | 'info' | 'warning';

  export type GaoxinExportReadinessStatus =
    | 'high_risk'
    | 'needs_completion'
    | 'ready';

  export interface GaoxinExportReadinessIssue {
    actionText: string;
    blockingExport: boolean;
    description: string;
    key: string;
    level: GaoxinExportReadinessIssueLevel;
    moduleKey?: string;
    source: 'book' | 'enterprise_profile' | 'evidence_chain' | 'material' | 'score';
    tabKey?: string;
    title: string;
  }

  export interface GaoxinExportReadiness {
    bookCompletionRate: null | number;
    canExport: boolean;
    declarationId: string;
    gaoxinScore: null | number;
    generatedAt: string;
    hasGaoxinContent: boolean;
    issueCounts: Record<GaoxinExportReadinessIssueLevel, number>;
    issues: GaoxinExportReadinessIssue[];
    materialReadinessScore: number;
    projectId: string;
    projectName: string;
    riskLevel: ClientDeclareProjectApi.MaterialRiskLevel;
    status: GaoxinExportReadinessStatus;
    summary: string;
  }
}

async function getClientDeclarationsApi(
  params: ClientDeclarationApi.DeclarationListParams = {},
) {
  return requestClient.get<ClientDeclarationApi.DeclarationListResult>(
    '/client/declarations',
    { params },
  );
}

async function getClientDeclarationStatsApi() {
  return requestClient.get<ClientDeclarationApi.DeclarationStats>(
    '/client/declarations/stats',
  );
}

async function getClientDeclarationDetailApi(id: string) {
  return requestClient.get<ClientDeclarationApi.DeclarationItem>(
    `/client/declarations/${id}`,
  );
}

async function syncClientDeclarationSchemeApi(id: string) {
  return requestClient.post<ClientDeclarationApi.DeclarationItem>(
    `/client/declarations/${id}/sync-scheme`,
  );
}

async function advanceClientDeclarationFlowApi(id: string) {
  return requestClient.post<ClientDeclarationApi.DeclarationItem>(
    `/client/declarations/${id}/flow/advance`,
    { action: 'advance' },
  );
}

async function getClientDeclarationMaterialReadinessApi(id: string) {
  return requestClient.get<ClientDeclareProjectApi.MaterialReadiness>(
    `/client/declarations/${id}/material-readiness`,
  );
}

async function getClientDeclarationGaoxinScoreApi(id: string) {
  return requestClient.get<ClientDeclareProjectApi.GaoxinScoreResult>(
    `/client/declarations/${id}/gaoxin-score`,
  );
}

async function getClientDeclarationSchemeScoreApi(id: string) {
  return requestClient.get<null | ClientDeclarationApi.SchemeScoreResult>(
    `/client/declarations/${id}/scheme-score`,
  );
}

async function getClientDeclarationAiDiagnosisApi(id: string) {
  return requestClient.get<ClientDeclareProjectApi.GaoxinAiDiagnosis>(
    `/client/declarations/${id}/ai-diagnosis`,
  );
}

async function getClientDeclarationGaoxinBookApi(id: string) {
  return requestClient.get<ClientDeclarationApi.GaoxinBookDraft>(
    `/client/declarations/${id}/gaoxin-book`,
  );
}

async function saveClientDeclarationGaoxinBookApi(
  id: string,
  supplemental: Record<string, string>,
) {
  return requestClient.put<ClientDeclarationApi.GaoxinBookDraft>(
    `/client/declarations/${id}/gaoxin-book`,
    { supplemental },
  );
}

async function getClientDeclarationGaoxinExportReadinessApi(id: string) {
  return requestClient.get<ClientDeclarationApi.GaoxinExportReadiness>(
    `/client/declarations/${id}/gaoxin-export-readiness`,
  );
}

async function downloadClientDeclarationGaoxinExportPackageApi(id: string) {
  return requestClient.get<Blob>(
    `/client/declarations/${id}/gaoxin-export-package`,
    {
      responseType: 'blob',
    },
  );
}

async function checkClientDeclarationMaterialApi(id: string) {
  return requestClient.post<ClientDeclareProjectApi.MaterialReadiness>(
    `/client/declarations/${id}/material-check`,
  );
}

export {
  checkClientDeclarationMaterialApi,
  advanceClientDeclarationFlowApi,
  downloadClientDeclarationGaoxinExportPackageApi,
  getClientDeclarationAiDiagnosisApi,
  getClientDeclarationDetailApi,
  getClientDeclarationGaoxinBookApi,
  getClientDeclarationGaoxinExportReadinessApi,
  getClientDeclarationGaoxinScoreApi,
  getClientDeclarationSchemeScoreApi,
  getClientDeclarationMaterialReadinessApi,
  getClientDeclarationsApi,
  getClientDeclarationStatsApi,
  saveClientDeclarationGaoxinBookApi,
  syncClientDeclarationSchemeApi,
};
