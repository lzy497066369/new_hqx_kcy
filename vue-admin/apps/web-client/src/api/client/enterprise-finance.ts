import { requestClient } from '#/api/request';

const FINANCE_AI_PARSE_REQUEST_TIMEOUT = 180_000;

export namespace ClientEnterpriseFinanceApi {
  export type FileClass = 1 | 2 | 3;
  export type Quarter = 1;

  export interface EnterpriseRecordList<T> {
    items: T[];
    total: number;
  }

  export interface FinancialData {
    fz: number | string;
    fzl: number | string;
    high_tech_income?: null | number | string;
    id?: number | string;
    lr_total: number | string;
    main_business_income?: null | number | string;
    net_assets?: null | number | string;
    net_profit?: null | number | string;
    q: Quarter;
    rd_depreciation?: null | number | string;
    rd_design_fee?: null | number | string;
    rd_direct_input?: null | number | string;
    rd_entrusted_development?: null | number | string;
    rd_equipment_debugging_fee?: null | number | string;
    rd_intangible_amortization?: null | number | string;
    rd_other_expense?: null | number | string;
    rd_personnel_cost?: null | number | string;
    remark?: null | string;
    total_revenue?: null | number | string;
    xxsr: number | string;
    year: string;
    yffy: number | string;
    zxc: number | string;
  }

  export interface TaxAudit {
    file_class: FileClass;
    file_path?: null | string;
    id?: number | string;
    remark?: null | string;
    tax_category?: null | string;
    year: string;
  }

  export interface FinancialListParams {
    q?: Quarter;
    year?: string;
  }

  export interface TaxAuditListParams {
    file_class?: FileClass;
    tax_category?: string;
    year?: string;
  }

  export interface AiDraft<T = Record<string, unknown>> {
    approvedRecordId?: null | string;
    createTime?: string;
    draftPayload: T;
    draftType: string;
    id: string;
    reviewedAt?: null | string;
    reviewedBy?: null | string;
    sourceIds: string[];
    status: string;
    taskId?: null | string;
    updateTime?: string;
  }

  export interface AiDraftList<T = Record<string, unknown>> {
    items: Array<AiDraft<T>>;
    total: number;
  }

  export interface FinanceAiParseDraftPayload {
    confidence: number;
    existingFinancial?: null | Record<string, unknown>;
    existingTaxAudit?: null | Record<string, unknown>;
    financial?: null | Partial<FinancialData>;
    parseStatus: 'partial' | 'review_required' | 'success' | string;
    reviewWarnings: string[];
    sourceFileName: string;
    sourceFilePath: string;
    sourceMaterialId?: null | string;
    sourcePreviewUrl?: null | string;
    taxAudit?: null | Partial<TaxAudit>;
    year: string;
  }

  export interface FinanceAiParseUploadResult {
    drafts: Array<AiDraft<FinanceAiParseDraftPayload>>;
    taskId: string;
    total: number;
  }

  export interface FinanceAiParseApproveResult {
    failed: Array<{ draftId: string; reason: string }>;
    success: Array<{ draftId: string; recordIds: string[] }>;
    total: number;
  }

}

async function listRecords<T>(tabKey: string) {
  return requestClient.get<ClientEnterpriseFinanceApi.EnterpriseRecordList<T>>(
    `/client/enterprise-records/finance/${tabKey}`,
  );
}

async function createRecord<T>(tabKey: string, data: T) {
  return requestClient.post<T>(`/client/enterprise-records/finance/${tabKey}`, {
    data,
  });
}

async function updateRecord<T>(tabKey: string, id: number | string, data: T) {
  return requestClient.put<T>(
    `/client/enterprise-records/finance/${tabKey}/${id}`,
    { data },
  );
}

async function deleteRecord(tabKey: string, id: number | string) {
  return requestClient.delete(`/client/enterprise-records/finance/${tabKey}/${id}`);
}

async function getClientFinancialDataListApi(
  _params: ClientEnterpriseFinanceApi.FinancialListParams = {},
) {
  return listRecords<ClientEnterpriseFinanceApi.FinancialData>('financial');
}

async function getClientTaxAuditListApi(
  _params: ClientEnterpriseFinanceApi.TaxAuditListParams = {},
) {
  return listRecords<ClientEnterpriseFinanceApi.TaxAudit>('taxAudit');
}

async function createClientFinancialDataApi(
  data: ClientEnterpriseFinanceApi.FinancialData,
) {
  return createRecord('financial', data);
}

async function createClientTaxAuditApi(data: ClientEnterpriseFinanceApi.TaxAudit) {
  return createRecord('taxAudit', data);
}

async function updateClientFinancialDataApi(
  id: number | string,
  data: ClientEnterpriseFinanceApi.FinancialData,
) {
  return updateRecord('financial', id, data);
}

async function updateClientTaxAuditApi(
  id: number | string,
  data: ClientEnterpriseFinanceApi.TaxAudit,
) {
  return updateRecord('taxAudit', id, data);
}

async function deleteClientFinancialDataApi(id: number | string) {
  return deleteRecord('financial', id);
}

async function deleteClientTaxAuditApi(id: number | string) {
  return deleteRecord('taxAudit', id);
}

async function uploadClientFinanceAiParseFilesApi(files: File[]) {
  const data = new FormData();
  files.forEach((file) => data.append('files', file));

  return requestClient.post<ClientEnterpriseFinanceApi.FinanceAiParseUploadResult>(
    '/client/enterprise/finance/ai-parse/uploads',
    data,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: FINANCE_AI_PARSE_REQUEST_TIMEOUT,
    },
  );
}

async function getClientFinanceAiParseDraftsApi() {
  return requestClient.get<
    ClientEnterpriseFinanceApi.AiDraftList<ClientEnterpriseFinanceApi.FinanceAiParseDraftPayload>
  >('/client/enterprise/finance/ai-parse/drafts', {
    timeout: FINANCE_AI_PARSE_REQUEST_TIMEOUT,
  });
}

async function approveClientFinanceAiParseDraftsApi(ids: Array<number | string>) {
  return requestClient.post<ClientEnterpriseFinanceApi.FinanceAiParseApproveResult>(
    '/client/enterprise/finance/ai-parse/approve',
    { ids },
    { timeout: FINANCE_AI_PARSE_REQUEST_TIMEOUT },
  );
}

async function rejectClientFinanceAiParseDraftsApi(ids: Array<number | string>) {
  return requestClient.post<ClientEnterpriseFinanceApi.FinanceAiParseApproveResult>(
    '/client/enterprise/finance/ai-parse/reject',
    { ids },
    { timeout: FINANCE_AI_PARSE_REQUEST_TIMEOUT },
  );
}

async function deleteClientFinanceAiParseDraftApi(id: number | string) {
  return requestClient.delete<{ id: string; success: boolean }>(
    `/client/enterprise/finance/ai-parse/drafts/${id}`,
    { timeout: FINANCE_AI_PARSE_REQUEST_TIMEOUT },
  );
}

export {
  approveClientFinanceAiParseDraftsApi,
  createClientFinancialDataApi,
  createClientTaxAuditApi,
  deleteClientFinanceAiParseDraftApi,
  deleteClientFinancialDataApi,
  deleteClientTaxAuditApi,
  getClientFinanceAiParseDraftsApi,
  getClientFinancialDataListApi,
  getClientTaxAuditListApi,
  rejectClientFinanceAiParseDraftsApi,
  updateClientFinancialDataApi,
  updateClientTaxAuditApi,
  uploadClientFinanceAiParseFilesApi,
};
