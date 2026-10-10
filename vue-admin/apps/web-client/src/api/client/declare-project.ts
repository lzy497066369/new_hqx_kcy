import { requestClient } from '#/api/request';

import type { ClientDeclarationApi } from './declaration';
import { getClientPolicyFileDetailApi } from './policy';
import type { ClientPolicyApi } from './policy';

export namespace ClientDeclareProjectApi {
  export interface DeclarationCapabilities {
    exportPackage: boolean;
    gaoxinScore: boolean;
    score: boolean;
  }

  export interface DeclareProjectListParams {
    keyword?: string;
    page?: number;
    pageSize?: number;
    policyType?: string;
    regionId?: string;
  }

  export interface DeclareProject {
    applicableObjects: null | string;
    basicDescription: null | string;
    canCreateDeclaration: boolean;
    existingDeclaration: null | {
      declarationNo: string;
      id: string;
      regionId: null | string;
      regionName: null | string;
      status: ClientDeclarationApi.DeclarationStatus | string;
      updateTime: string;
    };
    id: string;
    matchedPolicyCount: number;
    matchedPolicies: ClientPolicyApi.PolicyFile[];
    name: string;
    nearestDeadline: null | string;
    policyType: null | string;
    regionNames: string[];
    scheme: null | {
      capabilities: DeclarationCapabilities;
      id: string;
      qualification: {
        missing: string[];
        status: 'eligible' | 'ineligible';
      };
      regionId: null | string;
      schemeName: string;
      version: string;
    };
    subsidyText: null | string;
  }

  export interface SchemeScoreResult {
    items: Array<{
      label: string;
      maxScore: number;
      score: number;
      source: string;
      value: number;
    }>;
    passScore: number;
    passed: boolean;
    schemeId: string;
    schemeVersion: string;
    totalScore: number;
  }

  export interface DeclareProjectListResult {
    items: DeclareProject[];
    total: number;
  }

  export type MaterialCheckStatus = 'missing' | 'partial' | 'passed';

  export type MaterialRiskLevel = 'high' | 'low' | 'medium';

  export interface MaterialCheckItem {
    attachmentMissing: boolean;
    checkStatus: MaterialCheckStatus;
    itemName: string;
    matchedCount: number;
    matchedRecordIds: string[];
    missingFields: string[];
    moduleKey: string;
    relationSummary?: Record<string, string[]>;
    requirementItemId: string | null;
    requiredCount: number;
    score: number;
    suggestion: string | null;
    tabKey: string;
  }

  export interface MaterialReadiness {
    checkId: string;
    checkedAt: string;
    checkStatus: MaterialCheckStatus;
    enterpriseId: string;
    items: MaterialCheckItem[];
    missingItems: number;
    passedItems: number;
    projectId: string;
    projectName: string;
    readinessScore: number;
    requirementId: string;
    requirementName: string;
    riskLevel: MaterialRiskLevel;
    totalItems: number;
    version: string;
  }

  export type ProjectReadiness = MaterialReadiness;

  export type GaoxinScoreRiskLevel = 'high' | 'low' | 'medium';

  export interface GaoxinScoreSuggestion {
    moduleKey: string;
    tabKey: string;
    text: string;
  }

  export interface GaoxinScoreCategory {
    deductions: string[];
    evidence: string[];
    evidenceChain: {
      complete: boolean;
      missing: string[];
      summary: string;
    };
    key: 'achievement' | 'growth' | 'ip' | 'rdManagement';
    label: string;
    maxScore: number;
    missingEvidenceCount: number;
    riskLevel: GaoxinScoreRiskLevel;
    ruleItems: string[];
    score: number;
    suggestions: GaoxinScoreSuggestion[];
  }

  export interface GaoxinScoreResult {
    calculatedAt: string;
    categories: GaoxinScoreCategory[];
    passScore: number;
    passed: boolean;
    riskLevel: GaoxinScoreRiskLevel;
    ruleVersion: string;
    sourceCounts: Record<string, number>;
    summary: string;
    totalScore: number;
  }

  export interface GaoxinAiDiagnosisAction {
    actionText: string;
    description: string;
    key: string;
    moduleKey?: string;
    priority: 'high' | 'low' | 'medium';
    tabKey?: string;
    title: string;
  }

  export interface GaoxinAiDiagnosis {
    adapterError?: string;
    adapterStatus: 'fallback_after_error' | 'fallback_not_configured' | 'success';
    advantages: string[];
    aiModel?: string;
    aiTaskId?: string;
    bookCompletionRate?: number;
    conclusion: 'can_try' | 'not_ready' | 'recommended';
    generatedAt: string;
    materialReadinessScore: number;
    mode: 'ai' | 'rule';
    nextSteps: string[];
    priorityActions: GaoxinAiDiagnosisAction[];
    projectId: string;
    projectName: string;
    riskLevel: MaterialRiskLevel;
    risks: string[];
    scoreGap: number;
    summary: string;
    totalScore: number;
  }
}

async function getClientDeclareProjectsApi(
  params: ClientDeclareProjectApi.DeclareProjectListParams = {},
) {
  return requestClient.get<ClientDeclareProjectApi.DeclareProjectListResult>(
    '/client/projects',
    { params },
  );
}

async function getClientDeclareProjectDetailApi(projectId: string, regionId?: string) {
  return requestClient.get<ClientDeclareProjectApi.DeclareProject>(
    `/client/projects/${projectId}`,
    { params: { regionId } },
  );
}

async function getClientDeclareProjectPolicyDetailApi(policyId: string) {
  return getClientPolicyFileDetailApi(policyId);
}

async function getClientDeclareProjectMaterialReadinessApi(projectId: string, regionId?: string) {
  return requestClient.get<ClientDeclareProjectApi.MaterialReadiness>(
    `/client/projects/${projectId}/material-readiness`,
    { params: { regionId } },
  );
}

async function getClientDeclareProjectGaoxinScoreApi(projectId: string, regionId?: string) {
  return requestClient.get<ClientDeclareProjectApi.GaoxinScoreResult>(
    `/client/projects/${projectId}/gaoxin-score`,
    { params: { regionId } },
  );
}

async function getClientDeclareProjectSchemeScoreApi(projectId: string, regionId?: string) {
  return requestClient.get<null | ClientDeclareProjectApi.SchemeScoreResult>(
    `/client/projects/${projectId}/scheme-score`,
    { params: { regionId } },
  );
}

async function getClientDeclareProjectAiDiagnosisApi(projectId: string, regionId?: string) {
  return requestClient.get<ClientDeclareProjectApi.GaoxinAiDiagnosis>(
    `/client/projects/${projectId}/ai-diagnosis`,
    { params: { regionId } },
  );
}

async function getClientDeclareProjectReadinessApi(projectId: string) {
  return getClientDeclareProjectMaterialReadinessApi(projectId);
}

async function checkClientDeclareProjectMaterialApi(
  projectId: string,
  declarationId?: string,
  regionId?: string,
) {
  return requestClient.post<ClientDeclareProjectApi.MaterialReadiness>(
    `/client/projects/${projectId}/material-check`,
    { declarationId, regionId },
  );
}

async function createClientDeclarationDraftApi(projectId: string, regionId?: string) {
  return requestClient.post<ClientDeclarationApi.DeclarationItem>(
    `/client/projects/${projectId}/declarations`,
    { regionId },
  );
}

export {
  checkClientDeclareProjectMaterialApi,
  createClientDeclarationDraftApi,
  getClientDeclareProjectAiDiagnosisApi,
  getClientDeclareProjectDetailApi,
  getClientDeclareProjectGaoxinScoreApi,
  getClientDeclareProjectSchemeScoreApi,
  getClientDeclareProjectPolicyDetailApi,
  getClientDeclareProjectsApi,
  getClientDeclareProjectReadinessApi,
  getClientDeclareProjectMaterialReadinessApi,
};
