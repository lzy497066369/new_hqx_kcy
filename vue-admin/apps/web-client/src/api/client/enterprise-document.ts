import { requestClient } from '#/api/request';

export namespace ClientEnterpriseDocumentApi {
  export type RuleClass = 1 | 2 | 3 | 4 | 5;
  export type RuleStatus = 1 | 2 | 3;

  export interface EnterpriseRecordList<T> {
    items: T[];
    total: number;
  }

  export interface RuleDocument {
    file_class: RuleClass;
    file_path?: null | string;
    file_remark?: null | string;
    file_start_date: string;
    file_status: RuleStatus;
    file_title: string;
    file_version: string;
    id?: number | string;
  }

  export interface RuleDocumentListParams {
    file_class?: RuleClass;
    file_status?: RuleStatus;
    keyword?: string;
  }

  export interface GaoxinDocumentDraft {
    content: string;
    fileClass: RuleClass;
    key: string;
    missingEvidence: string[];
    recommended: boolean;
    scoreItem: string;
    scoreMax: number;
    title: string;
  }

  export interface GaoxinDocumentPackage {
    drafts: GaoxinDocumentDraft[];
    generatedAt: string;
    profileSummary: {
      documentCount: number;
      enterpriseName: string;
      financeYearCount: number;
      rdCount: number;
      researchEmployeeCount: number;
      totalEmployeeCount: number;
      transformationCount: number;
    };
    scoreRules: Array<{
      description: string;
      maxScore: number;
      title: string;
    }>;
    summary: string;
  }

  export interface GaoxinDocumentAdoptResult {
    savedItems: RuleDocument[];
    skippedItems: Array<{
      key: string;
      title: string;
    }>;
    summary: string;
  }
}

async function getClientRuleDocumentListApi(
  _params: ClientEnterpriseDocumentApi.RuleDocumentListParams = {},
) {
  return requestClient.get<
    ClientEnterpriseDocumentApi.EnterpriseRecordList<ClientEnterpriseDocumentApi.RuleDocument>
  >('/client/enterprise-records/document/documents');
}

async function createClientRuleDocumentApi(
  data: ClientEnterpriseDocumentApi.RuleDocument,
) {
  return requestClient.post<ClientEnterpriseDocumentApi.RuleDocument>(
    '/client/enterprise-records/document/documents',
    { data },
  );
}

async function updateClientRuleDocumentApi(
  id: number | string,
  data: ClientEnterpriseDocumentApi.RuleDocument,
) {
  return requestClient.put<ClientEnterpriseDocumentApi.RuleDocument>(
    `/client/enterprise-records/document/documents/${id}`,
    { data },
  );
}

async function deleteClientRuleDocumentApi(id: number | string) {
  return requestClient.delete(`/client/enterprise-records/document/documents/${id}`);
}

async function getClientGaoxinDocumentPackageApi() {
  return requestClient.get<ClientEnterpriseDocumentApi.GaoxinDocumentPackage>(
    '/client/enterprise/documents/gaoxin-package',
  );
}

async function adoptClientGaoxinDocumentPackageApi(keys: string[]) {
  return requestClient.post<ClientEnterpriseDocumentApi.GaoxinDocumentAdoptResult>(
    '/client/enterprise/documents/gaoxin-package/adopt',
    { keys },
  );
}

export {
  adoptClientGaoxinDocumentPackageApi,
  createClientRuleDocumentApi,
  deleteClientRuleDocumentApi,
  getClientGaoxinDocumentPackageApi,
  getClientRuleDocumentListApi,
  updateClientRuleDocumentApi,
};
