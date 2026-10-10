import { requestClient } from '#/api/request';

const IP_RECOGNITION_REQUEST_TIMEOUT = 60_000;

export namespace ClientEnterprisePropertyApi {
  export type FundSource = 1 | 2 | 3 | 4 | 5 | 6;
  export type IPStatus = 1 | 2;
  export type IPType = 1 | 2 | 3 | 4;
  export type ProjectStatus = 1 | 3 | 4;

  export interface EnterpriseRecordList<T> {
    items: T[];
    total: number;
  }

  export interface EnterpriseRecordClearResult {
    clearedCount: number;
    moduleKey: string;
    results?: Array<{ clearedCount: number; tabKey: string }>;
    success: boolean;
    tabKey?: string;
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

  export interface AiTaskResult {
    confidence?: null | string;
    id: string;
    scene: string;
    status: string;
    structuredResult: Record<string, unknown>;
    summary?: null | string;
  }

  export interface AiTask<T = Record<string, unknown>> {
    createTime: string;
    drafts?: Array<AiDraft<T>>;
    errorMessage?: null | string;
    finishedAt?: null | string;
    id: string;
    inputSnapshot: Record<string, unknown>;
    result?: AiTaskResult | null;
    resultId?: null | string;
    scene: string;
    status: string;
    updateTime: string;
  }

  export interface AiTaskList<T = Record<string, unknown>> {
    items: Array<AiTask<T>>;
    total: number;
  }

  export interface IpRecognitionDraftPayload extends Partial<IntellectualProperty> {
    ai_adapter?: null | string;
    ai_adapter_error?: null | string;
    ai_adapter_status?:
      | 'fallback_after_error'
      | 'fallback_not_configured'
      | 'success'
      | string;
    ai_model?: null | string;
    confidence?: number;
    duplicate_record_id?: null | string;
    duplicate_status?: 'draft_duplicate' | 'existing_record' | 'none' | 'unchecked';
    duplicate_warning?: null | string;
    needs_review?: boolean;
    pdf_text_field_hit_score?: number;
    pdf_text_status?: 'empty' | 'failed' | 'success' | 'unreadable' | string;
    recognition_note?: null | string;
    review_warnings?: string[];
    right_holder_match_status?: 'matched' | 'mismatched' | 'unchecked' | string;
    right_holder_match_text?: null | string;
    source_file_name?: null | string;
    source_file_path?: null | string;
  }

  export interface IpRecognitionUploadResult {
    drafts: Array<AiDraft<IpRecognitionDraftPayload>>;
    taskId: string;
    total: number;
  }

  export interface IpRecognitionTaskCreatePayload {
    ids?: Array<number | string>;
    materialIds?: Array<number | string>;
  }

  export interface IpRecognitionApproveResult {
    failed: Array<{ draftId: string; reason: string }>;
    success: Array<{ draftId: string; recordId: string }>;
    total: number;
  }

  export interface IpRecognitionRetryResult {
    failed: Array<{ draftId: string; reason: string }>;
    success: Array<AiDraft<IpRecognitionDraftPayload>>;
    taskId: string;
    total: number;
  }

  export interface IpRecognitionRejectResult {
    failed: Array<{ draftId: string; reason: string }>;
    success: Array<{ draftId: string }>;
    total: number;
  }

  export interface TransformationGenerationSource {
    authorizeDate?: null | string;
    hasTransformation: boolean;
    id: string;
    ipCode?: null | string;
    ipLevel?: null | string;
    name?: null | string;
    number?: null | string;
    rightHolder?: null | string;
    type?: null | number;
  }

  export interface TransformationGenerationSourceList {
    items: TransformationGenerationSource[];
    total: number;
  }

  export interface TransformationGenerationDraftPayload
    extends Partial<Transformation> {
    review_warnings?: string[];
    source_ip_code?: null | string;
    source_ip_name?: null | string;
    source_ip_num?: null | string;
  }

  export interface TransformationGenerationResult {
    drafts: Array<AiDraft<TransformationGenerationDraftPayload>>;
    taskId: string;
    total: number;
  }

  export interface ResearchGenerationSource {
    authorizeDate?: null | string;
    hasResearchProject: boolean;
    id: string;
    ipCode?: null | string;
    ipLevel?: null | string;
    name?: null | string;
    number?: null | string;
    rightHolder?: null | string;
    type?: null | number;
  }

  export interface ResearchGenerationSourceList {
    items: ResearchGenerationSource[];
    total: number;
  }

  export interface ResearchGenerationDraftPayload
    extends Partial<ResearchProject> {
    review_warnings?: string[];
    source_ip_names?: string[];
  }

  export interface ResearchGenerationResult {
    drafts: Array<AiDraft<ResearchGenerationDraftPayload>>;
    taskId: string;
    total: number;
    warning: null | string;
  }

  export interface ResearchAutoMatchPreviewItem {
    category: string;
    ipIds: string[];
    ipNames: string[];
    plannedYear: number;
    technicalField: string;
    transformationIds: string[];
  }

  export interface ResearchAutoMatchPreview {
    availableIpCount: number;
    blockedReasons: string[];
    candidateCount: number;
    items: ResearchAutoMatchPreviewItem[];
    skippedIpCount: number;
    targetCount: number;
  }

  export interface ProductServiceGenerationSource {
    endDate?: null | string;
    hasProductService: boolean;
    id: string;
    initDate?: null | string;
    name?: null | string;
    number?: null | string;
    projectType?: null | string;
    relatedIpIds?: null | string;
    relatedIpLabels?: null | string;
  }

  export interface ProductServiceGenerationSourceList {
    items: ProductServiceGenerationSource[];
    total: number;
  }

  export interface ProductServiceGenerationDraftPayload
    extends Partial<ProductService> {
    ps_name_candidates?: string[];
    related_ip_labels?: string;
    related_rd_labels?: string;
    related_transformation_labels?: string;
    review_warnings?: string[];
    source_ip_names?: string[];
    source_rd_names?: string[];
  }

  export interface ProductServiceGenerationResult {
    drafts: Array<AiDraft<ProductServiceGenerationDraftPayload>>;
    taskId: string;
    total: number;
  }

  export interface PropertyEvidenceNode {
    id: string;
    name: string;
    number?: null | string;
  }

  export interface PropertyEvidenceChain {
    gaps: string[];
    id: string;
    ip: PropertyEvidenceNode[];
    name: string;
    number?: null | string;
    ps: PropertyEvidenceNode[];
    transformation: PropertyEvidenceNode[];
  }

  export interface PropertyEvidenceStats {
    completeRdChains: number;
    gapTotal: number;
    intellectualPropertyTotal: number;
    ipUsedInChain: number;
    psTotal: number;
    psWithIp: number;
    psWithRd: number;
    rdTotal: number;
    rdWithIp: number;
    readinessPercent: number;
    transformationTotal: number;
    transformationWithIp: number;
  }

  export interface PropertyEvidenceChecklistItem {
    detail: string;
    key: string;
    label: string;
    status: 'missing' | 'passed' | 'warning';
  }

  export interface PropertyEvidenceSummary {
    chains: PropertyEvidenceChain[];
    checklist: PropertyEvidenceChecklistItem[];
    gaps: string[];
    generatedAt: string;
    stats: PropertyEvidenceStats;
  }

  export interface PropertyEvidenceRepairResult {
    changedRecords: number;
    repairedAt: string;
    scannedRecords: number;
  }

  export interface PropertyTechnologyFieldClassificationResult {
    adapterStatus: string;
    items: Array<{
      confidence: 'high' | 'low' | 'medium';
      field: null | string;
      id: string;
      recordType: string;
      topLevel: null | string;
    }>;
    taskId?: string;
    total: number;
    updated: number;
  }

  export interface PropertyAiReadiness {
    ai: {
      configured: boolean;
      enabled: boolean;
      message: string;
    };
    generatedAt: string;
    mode: 'ai_only' | 'fallback_only';
  }

  export interface IntellectualProperty {
    advanced_degree?: null | string;
    apply_date: string;
    authorize_date?: null | string;
    id?: number | string;
    inventor?: null | string;
    ip_code?: null | string;
    ip_level?: null | string;
    ip_tech_category?: null | string;
    is_core_ip?: null | 0 | 1;
    obtain_method?: null | string;
    related_ps_ids?: null | string;
    related_rd_ids?: null | string;
    related_transformation_ids?: null | string;
    remark?: null | string;
    right_holder?: null | string;
    soft_work_file?: null | string;
    soft_work_name: string;
    soft_work_num: string;
    soft_work_status: IPStatus;
    soft_work_type: IPType;
    support_effect?: null | string;
  }

  export interface ResearchProject {
    core_technology?: null | string;
    end_date: string;
    fund_amount?: null | number | string;
    fund_source?: FundSource | null;
    id?: number | string;
    innovation_points?: null | string;
    init_date: string;
    ky_project_des?: null | string;
    ky_project_leader?: null | string;
    ky_project_name: string;
    ky_project_num: string;
    ky_project_status: ProjectStatus;
    lxbg_file?: null | string;
    project_type?: null | string;
    rd_budget?: null | number | string;
    rd_expense_total?: null | number | string;
    rd_organization_method?: null | string;
    related_ip_ids?: null | string;
    related_ps_ids?: null | string;
    related_transformation_ids?: null | string;
    stage_result?: null | string;
  }

  export interface ProductService {
    competitive_advantage?: null | string;
    high_tech_income?: null | number | string;
    id?: number | string;
    last_year_income?: null | number | string;
    proof_files?: null | string;
    ps_code?: null | string;
    ps_name: string;
    related_contract_ids?: null | string;
    related_invoice_ids?: null | string;
    related_ip_ids?: null | string;
    related_rd_ids?: null | string;
    related_transformation_ids?: null | string;
    remark?: null | string;
    tech_description?: null | string;
    tech_field?: null | string;
    tech_index?: null | string;
    tech_source?: null | string;
  }

  export interface Transformation {
    application_scene?: null | string;
    customer_name?: null | string;
    id?: number | string;
    proof_files?: null | string;
    related_contract_ids?: null | string;
    related_invoice_ids?: null | string;
    related_ip_ids?: null | string;
    related_ps_ids?: null | string;
    related_rd_ids?: null | string;
    remark?: null | string;
    transformation_code?: null | string;
    transformation_income?: null | number | string;
    transformation_method?: null | string;
    transformation_name: string;
    transformation_year?: null | string;
  }

  export interface IntellectualPropertyListParams {
    keyword?: string;
    soft_work_status?: IPStatus;
    soft_work_type?: IPType;
  }

  export interface ResearchProjectListParams {
    keyword?: string;
    ky_project_status?: ProjectStatus;
  }
}

async function listRecords<T>(tabKey: string) {
  return requestClient.get<ClientEnterprisePropertyApi.EnterpriseRecordList<T>>(
    `/client/enterprise-records/property/${tabKey}`,
  );
}

async function createRecord<T>(tabKey: string, data: T) {
  return requestClient.post<T>(`/client/enterprise-records/property/${tabKey}`, {
    data,
  });
}

async function updateRecord<T>(tabKey: string, id: number | string, data: T) {
  return requestClient.put<T>(
    `/client/enterprise-records/property/${tabKey}/${id}`,
    { data },
  );
}

async function deleteRecord(tabKey: string, id: number | string) {
  return requestClient.delete(`/client/enterprise-records/property/${tabKey}/${id}`);
}

async function clearRecordsByTab(tabKey: string) {
  return requestClient.delete<ClientEnterprisePropertyApi.EnterpriseRecordClearResult>(
    `/client/enterprise-records/property/${tabKey}`,
  );
}

async function clearAllPropertyRecordsApi() {
  return requestClient.delete<ClientEnterprisePropertyApi.EnterpriseRecordClearResult>(
    '/client/enterprise-records/property',
  );
}

async function getClientIntellectualPropertyListApi(
  _params: ClientEnterprisePropertyApi.IntellectualPropertyListParams = {},
) {
  return listRecords<ClientEnterprisePropertyApi.IntellectualProperty>(
    'intellectualProperty',
  );
}

async function getClientResearchProjectListApi(
  _params: ClientEnterprisePropertyApi.ResearchProjectListParams = {},
) {
  return listRecords<ClientEnterprisePropertyApi.ResearchProject>('researchProject');
}

async function getClientProductServiceListApi() {
  return listRecords<ClientEnterprisePropertyApi.ProductService>('productService');
}

async function getClientTransformationListApi() {
  return listRecords<ClientEnterprisePropertyApi.Transformation>('transformation');
}

async function createClientIntellectualPropertyApi(
  data: ClientEnterprisePropertyApi.IntellectualProperty,
) {
  return createRecord('intellectualProperty', data);
}

async function createClientResearchProjectApi(
  data: ClientEnterprisePropertyApi.ResearchProject,
) {
  return createRecord('researchProject', data);
}

async function createClientProductServiceApi(
  data: ClientEnterprisePropertyApi.ProductService,
) {
  return createRecord('productService', data);
}

async function createClientTransformationApi(
  data: ClientEnterprisePropertyApi.Transformation,
) {
  return createRecord('transformation', data);
}

async function updateClientIntellectualPropertyApi(
  id: number | string,
  data: ClientEnterprisePropertyApi.IntellectualProperty,
) {
  return updateRecord('intellectualProperty', id, data);
}

async function updateClientResearchProjectApi(
  id: number | string,
  data: ClientEnterprisePropertyApi.ResearchProject,
) {
  return updateRecord('researchProject', id, data);
}

async function updateClientProductServiceApi(
  id: number | string,
  data: ClientEnterprisePropertyApi.ProductService,
) {
  return updateRecord('productService', id, data);
}

async function updateClientTransformationApi(
  id: number | string,
  data: ClientEnterprisePropertyApi.Transformation,
) {
  return updateRecord('transformation', id, data);
}

async function deleteClientIntellectualPropertyApi(id: number | string) {
  return deleteRecord('intellectualProperty', id);
}

async function deleteClientResearchProjectApi(id: number | string) {
  return deleteRecord('researchProject', id);
}

async function deleteClientProductServiceApi(id: number | string) {
  return deleteRecord('productService', id);
}

async function deleteClientTransformationApi(id: number | string) {
  return deleteRecord('transformation', id);
}

async function clearClientIntellectualPropertyApi() {
  return clearRecordsByTab('intellectualProperty');
}

async function clearClientResearchProjectApi() {
  return clearRecordsByTab('researchProject');
}

async function clearClientProductServiceApi() {
  return clearRecordsByTab('productService');
}

async function clearClientTransformationRecordsApi() {
  return clearRecordsByTab('transformation');
}

async function uploadClientIpRecognitionPdfsApi(files: File[]) {
  const data = new FormData();
  files.forEach((file) => data.append('files', file));

  return requestClient.post<ClientEnterprisePropertyApi.IpRecognitionUploadResult>(
    '/client/enterprise/property/ip-recognition/uploads',
    data,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: IP_RECOGNITION_REQUEST_TIMEOUT,
    },
  );
}

async function getClientIpRecognitionDraftsApi() {
  return requestClient.get<
    ClientEnterprisePropertyApi.AiDraftList<ClientEnterprisePropertyApi.IpRecognitionDraftPayload>
  >('/client/enterprise/property/ip-recognition/drafts', {
    timeout: IP_RECOGNITION_REQUEST_TIMEOUT,
  });
}

async function getClientIpRecognitionTaskApi(id: number | string) {
  return requestClient.get<
    ClientEnterprisePropertyApi.AiTask<ClientEnterprisePropertyApi.IpRecognitionDraftPayload>
  >(`/client/enterprise/property/ip-recognition/tasks/${id}`, {
    timeout: IP_RECOGNITION_REQUEST_TIMEOUT,
  });
}

async function createClientIpRecognitionTaskApi(
  data: ClientEnterprisePropertyApi.IpRecognitionTaskCreatePayload,
) {
  return requestClient.post<ClientEnterprisePropertyApi.IpRecognitionUploadResult>(
    '/client/enterprise/property/ip-recognition/tasks',
    data,
    { timeout: IP_RECOGNITION_REQUEST_TIMEOUT },
  );
}

async function getClientPropertyAiTasksApi() {
  return requestClient.get<ClientEnterprisePropertyApi.AiTaskList>(
    '/client/enterprise/property/ai-tasks',
  );
}

async function getClientPropertyEvidenceSummaryApi() {
  return requestClient.get<ClientEnterprisePropertyApi.PropertyEvidenceSummary>(
    '/client/enterprise/property/evidence-summary',
  );
}

async function getClientPropertyAiReadinessApi() {
  return requestClient.get<ClientEnterprisePropertyApi.PropertyAiReadiness>(
    '/client/enterprise/property/ai-readiness',
  );
}

async function repairClientPropertyEvidenceRelationsApi() {
  return requestClient.post<ClientEnterprisePropertyApi.PropertyEvidenceRepairResult>(
    '/client/enterprise/property/evidence-relations/repair',
  );
}

async function classifyClientPropertyTechnologyFieldsApi() {
  return requestClient.post<ClientEnterprisePropertyApi.PropertyTechnologyFieldClassificationResult>(
    '/client/enterprise/property/technology-fields/classify',
  );
}

async function updateClientIpRecognitionDraftApi(
  id: number | string,
  data: ClientEnterprisePropertyApi.IpRecognitionDraftPayload,
) {
  return requestClient.put<
    ClientEnterprisePropertyApi.AiDraft<ClientEnterprisePropertyApi.IpRecognitionDraftPayload>
  >(
    `/client/enterprise/property/ip-recognition/drafts/${id}`,
    { data },
    { timeout: IP_RECOGNITION_REQUEST_TIMEOUT },
  );
}

async function approveClientIpRecognitionDraftsApi(ids: Array<number | string>) {
  return requestClient.post<ClientEnterprisePropertyApi.IpRecognitionApproveResult>(
    '/client/enterprise/property/ip-recognition/approve',
    { ids },
    { timeout: IP_RECOGNITION_REQUEST_TIMEOUT },
  );
}

async function rejectClientIpRecognitionDraftsApi(ids: Array<number | string>) {
  return requestClient.post<ClientEnterprisePropertyApi.IpRecognitionRejectResult>(
    '/client/enterprise/property/ip-recognition/reject',
    { ids },
    { timeout: IP_RECOGNITION_REQUEST_TIMEOUT },
  );
}

async function deleteClientIpRecognitionDraftApi(id: number | string) {
  return requestClient.delete<{ draftId: string; success: boolean }>(
    `/client/enterprise/property/ip-recognition/drafts/${id}`,
    { timeout: IP_RECOGNITION_REQUEST_TIMEOUT },
  );
}

async function retryClientIpRecognitionDraftsApi(ids: Array<number | string>) {
  return requestClient.post<ClientEnterprisePropertyApi.IpRecognitionRetryResult>(
    '/client/enterprise/property/ip-recognition/retry',
    { ids },
    { timeout: IP_RECOGNITION_REQUEST_TIMEOUT },
  );
}

async function getClientTransformationGenerationSourcesApi() {
  return requestClient.get<ClientEnterprisePropertyApi.TransformationGenerationSourceList>(
    '/client/enterprise/property/transformation/generation/sources',
  );
}

async function createClientTransformationGenerationTaskApi(data: {
  businessMode?: 'auto' | 'mixed' | 'product' | 'service';
  includeExisting?: boolean;
  ipIds?: Array<number | string>;
  targetCount?: number;
}) {
  return requestClient.post<ClientEnterprisePropertyApi.TransformationGenerationResult>(
    '/client/enterprise/property/transformation/generation/tasks',
    data,
  );
}

async function getClientTransformationGenerationTaskApi(id: number | string) {
  return requestClient.get<
    ClientEnterprisePropertyApi.AiTask<ClientEnterprisePropertyApi.TransformationGenerationDraftPayload>
  >(`/client/enterprise/property/transformation/generation/tasks/${id}`);
}

async function getClientTransformationGenerationDraftsApi() {
  return requestClient.get<
    ClientEnterprisePropertyApi.AiDraftList<ClientEnterprisePropertyApi.TransformationGenerationDraftPayload>
  >('/client/enterprise/property/transformation/generation/drafts');
}

async function updateClientTransformationGenerationDraftApi(
  id: number | string,
  data: ClientEnterprisePropertyApi.TransformationGenerationDraftPayload,
) {
  return requestClient.put<
    ClientEnterprisePropertyApi.AiDraft<ClientEnterprisePropertyApi.TransformationGenerationDraftPayload>
  >(`/client/enterprise/property/transformation/generation/drafts/${id}`, {
    data,
  });
}

async function approveClientTransformationGenerationDraftsApi(
  ids: Array<number | string>,
) {
  return requestClient.post<ClientEnterprisePropertyApi.IpRecognitionApproveResult>(
    '/client/enterprise/property/transformation/generation/approve',
    { ids },
  );
}

async function rejectClientTransformationGenerationDraftsApi(
  ids: Array<number | string>,
) {
  return requestClient.post<ClientEnterprisePropertyApi.IpRecognitionRejectResult>(
    '/client/enterprise/property/transformation/generation/reject',
    { ids },
  );
}

async function deleteClientTransformationGenerationDraftApi(
  id: number | string,
) {
  return requestClient.delete<{ id: string; success: boolean }>(
    `/client/enterprise/property/transformation/generation/drafts/${id}`,
  );
}

async function getClientResearchGenerationSourcesApi() {
  return requestClient.get<ClientEnterprisePropertyApi.ResearchGenerationSourceList>(
    '/client/enterprise/property/research/generation/sources',
  );
}

async function createClientResearchGenerationTaskApi(data: {
  endDate: string;
  initDate: string;
  ipIds?: Array<number | string>;
  leader?: null | string;
  rdBudget?: null | string;
  remark?: null | string;
  technicalField?: null | string;
}) {
  return requestClient.post<ClientEnterprisePropertyApi.ResearchGenerationResult>(
    '/client/enterprise/property/research/generation/tasks',
    data,
  );
}

async function createClientResearchAutoMatchTaskApi(data?: {
  ipIds?: Array<number | string>;
  targetCount?: number;
}) {
  return requestClient.post<ClientEnterprisePropertyApi.ResearchGenerationResult>(
    '/client/enterprise/property/research/generation/auto-match/tasks',
    data ?? {},
  );
}

async function previewClientResearchAutoMatchApi(data?: {
  ipIds?: Array<number | string>;
  targetCount?: number;
}) {
  return requestClient.post<ClientEnterprisePropertyApi.ResearchAutoMatchPreview>(
    '/client/enterprise/property/research/generation/auto-match/preview',
    data ?? {},
  );
}

async function getClientResearchGenerationTaskApi(id: number | string) {
  return requestClient.get<
    ClientEnterprisePropertyApi.AiTask<ClientEnterprisePropertyApi.ResearchGenerationDraftPayload>
  >(`/client/enterprise/property/research/generation/tasks/${id}`);
}

async function getClientResearchGenerationDraftsApi() {
  return requestClient.get<
    ClientEnterprisePropertyApi.AiDraftList<ClientEnterprisePropertyApi.ResearchGenerationDraftPayload>
  >('/client/enterprise/property/research/generation/drafts');
}

async function updateClientResearchGenerationDraftApi(
  id: number | string,
  data: ClientEnterprisePropertyApi.ResearchGenerationDraftPayload,
) {
  return requestClient.put<
    ClientEnterprisePropertyApi.AiDraft<ClientEnterprisePropertyApi.ResearchGenerationDraftPayload>
  >(`/client/enterprise/property/research/generation/drafts/${id}`, {
    data,
  });
}

async function approveClientResearchGenerationDraftsApi(
  ids: Array<number | string>,
) {
  return requestClient.post<ClientEnterprisePropertyApi.IpRecognitionApproveResult>(
    '/client/enterprise/property/research/generation/approve',
    { ids },
  );
}

async function rejectClientResearchGenerationDraftsApi(
  ids: Array<number | string>,
) {
  return requestClient.post<ClientEnterprisePropertyApi.IpRecognitionRejectResult>(
    '/client/enterprise/property/research/generation/reject',
    { ids },
  );
}

async function deleteClientResearchGenerationDraftApi(id: number | string) {
  return requestClient.delete<{ id: string; success: boolean }>(
    `/client/enterprise/property/research/generation/drafts/${id}`,
  );
}

async function deleteClientResearchGenerationDraftsApi(
  ids: Array<number | string>,
) {
  return requestClient.post<ClientEnterprisePropertyApi.IpRecognitionRejectResult>(
    '/client/enterprise/property/research/generation/drafts/batch-delete',
    { ids },
  );
}

async function getClientProductServiceGenerationSourcesApi() {
  return requestClient.get<ClientEnterprisePropertyApi.ProductServiceGenerationSourceList>(
    '/client/enterprise/property/product-service/generation/sources',
  );
}

async function createClientProductServiceGenerationTaskApi(data: {
  businessMode?: 'auto' | 'mixed' | 'product' | 'service';
  includeExisting?: boolean;
  rdIds?: Array<number | string>;
  targetCount?: number;
}) {
  return requestClient.post<ClientEnterprisePropertyApi.ProductServiceGenerationResult>(
    '/client/enterprise/property/product-service/generation/tasks',
    data,
  );
}

async function getClientProductServiceGenerationTaskApi(id: number | string) {
  return requestClient.get<
    ClientEnterprisePropertyApi.AiTask<ClientEnterprisePropertyApi.ProductServiceGenerationDraftPayload>
  >(`/client/enterprise/property/product-service/generation/tasks/${id}`);
}

async function getClientProductServiceGenerationDraftsApi() {
  return requestClient.get<
    ClientEnterprisePropertyApi.AiDraftList<ClientEnterprisePropertyApi.ProductServiceGenerationDraftPayload>
  >('/client/enterprise/property/product-service/generation/drafts');
}

async function updateClientProductServiceGenerationDraftApi(
  id: number | string,
  data: ClientEnterprisePropertyApi.ProductServiceGenerationDraftPayload,
) {
  return requestClient.put<
    ClientEnterprisePropertyApi.AiDraft<ClientEnterprisePropertyApi.ProductServiceGenerationDraftPayload>
  >(`/client/enterprise/property/product-service/generation/drafts/${id}`, {
    data,
  });
}

async function duplicateClientProductServiceGenerationDraftApi(
  id: number | string,
) {
  return requestClient.post<
    ClientEnterprisePropertyApi.AiDraft<ClientEnterprisePropertyApi.ProductServiceGenerationDraftPayload>
  >(
    `/client/enterprise/property/product-service/generation/drafts/${id}/duplicate`,
  );
}

async function deleteClientProductServiceGenerationDraftApi(
  id: number | string,
) {
  return requestClient.delete<{ id: string; success: boolean }>(
    `/client/enterprise/property/product-service/generation/drafts/${id}`,
  );
}

async function approveClientProductServiceGenerationDraftsApi(
  ids: Array<number | string>,
) {
  return requestClient.post<ClientEnterprisePropertyApi.IpRecognitionApproveResult>(
    '/client/enterprise/property/product-service/generation/approve',
    { ids },
  );
}

async function rejectClientProductServiceGenerationDraftsApi(
  ids: Array<number | string>,
) {
  return requestClient.post<ClientEnterprisePropertyApi.IpRecognitionRejectResult>(
    '/client/enterprise/property/product-service/generation/reject',
    { ids },
  );
}

export {
  approveClientIpRecognitionDraftsApi,
  approveClientProductServiceGenerationDraftsApi,
  approveClientResearchGenerationDraftsApi,
  approveClientTransformationGenerationDraftsApi,
  clearAllPropertyRecordsApi,
  clearClientIntellectualPropertyApi,
  clearClientProductServiceApi,
  clearClientResearchProjectApi,
  clearClientTransformationRecordsApi,
  classifyClientPropertyTechnologyFieldsApi,
  createClientIpRecognitionTaskApi,
  createClientProductServiceGenerationTaskApi,
  createClientResearchAutoMatchTaskApi,
  previewClientResearchAutoMatchApi,
  createClientResearchGenerationTaskApi,
  createClientTransformationGenerationTaskApi,
  createClientIntellectualPropertyApi,
  createClientProductServiceApi,
  createClientResearchProjectApi,
  createClientTransformationApi,
  deleteClientIpRecognitionDraftApi,
  deleteClientIntellectualPropertyApi,
  deleteClientProductServiceGenerationDraftApi,
  deleteClientProductServiceApi,
  deleteClientResearchGenerationDraftApi,
  deleteClientResearchGenerationDraftsApi,
  deleteClientResearchProjectApi,
  deleteClientTransformationGenerationDraftApi,
  deleteClientTransformationApi,
  duplicateClientProductServiceGenerationDraftApi,
  getClientIpRecognitionDraftsApi,
  getClientIpRecognitionTaskApi,
  getClientIntellectualPropertyListApi,
  getClientPropertyAiTasksApi,
  getClientPropertyAiReadinessApi,
  getClientPropertyEvidenceSummaryApi,
  getClientProductServiceGenerationTaskApi,
  getClientProductServiceGenerationDraftsApi,
  getClientProductServiceGenerationSourcesApi,
  getClientProductServiceListApi,
  getClientResearchGenerationTaskApi,
  getClientResearchGenerationDraftsApi,
  getClientResearchGenerationSourcesApi,
  getClientResearchProjectListApi,
  getClientTransformationGenerationTaskApi,
  getClientTransformationGenerationDraftsApi,
  getClientTransformationGenerationSourcesApi,
  getClientTransformationListApi,
  repairClientPropertyEvidenceRelationsApi,
  rejectClientIpRecognitionDraftsApi,
  rejectClientProductServiceGenerationDraftsApi,
  rejectClientResearchGenerationDraftsApi,
  rejectClientTransformationGenerationDraftsApi,
  updateClientIpRecognitionDraftApi,
  updateClientIntellectualPropertyApi,
  updateClientProductServiceGenerationDraftApi,
  updateClientProductServiceApi,
  updateClientResearchGenerationDraftApi,
  updateClientResearchProjectApi,
  updateClientTransformationGenerationDraftApi,
  updateClientTransformationApi,
  retryClientIpRecognitionDraftsApi,
  uploadClientIpRecognitionPdfsApi,
};
