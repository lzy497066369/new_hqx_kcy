import type { AiScene } from './dto';

export type AiTaskStatus = 'failed' | 'pending' | 'running' | 'success';
export type AiResultStatus = 'applied' | 'confirmed' | 'draft' | 'rejected';

export type AiChatMessageContent =
  | string
  | Array<
      | { text: string; type: 'text' }
      | { image_url: { url: string }; type: 'image_url' }
    >;

export interface AiChatMessage {
  content: AiChatMessageContent;
  role: 'assistant' | 'system' | 'user';
}

export interface AiChatRequest {
  extraBody?: Record<string, unknown>;
  messages: AiChatMessage[];
  model?: string;
  responseFormat?: 'json_object' | 'text';
}

export interface AiChatResponse {
  content: string;
  model: string;
  rawResponse: unknown;
  tokenUsage: null | unknown;
}

export interface AiChatStreamChunk {
  content?: string;
  rawChunk: unknown;
}

export interface AiChatStreamResult {
  content: string;
  model: string;
  rawChunks: unknown[];
  tokenUsage: null | unknown;
}

export interface AiSceneContext {
  bizId: string;
  bizType: string;
  data: unknown;
  title: string;
}

export interface AiSceneRunResult {
  confidence?: null | string;
  prompt: string;
  rawResponse: string;
  structuredResult: unknown;
  summary: null | string;
  tokenUsage: null | unknown;
}

export interface AiTaskItem {
  auditLogs?: AiAuditLogItem[];
  bizId: string;
  bizType: string;
  createTime: string;
  errorMessage: null | string;
  finishedAt: null | string;
  id: string;
  inputSnapshot: null | unknown;
  result: AiTaskResultItem | null;
  resultId: null | string;
  scene: AiScene | string;
  status: string;
  updateTime: string;
}

export interface AiAuditLogItem {
  cost: null | string;
  createTime: string;
  durationMs: null | number;
  errorMessage: null | string;
  id: string;
  model: string;
  prompt: string;
  provider: string;
  rawResponse: null | string;
  taskId: string;
  tokenUsage: null | unknown;
  updateTime: string;
}

export interface AiTaskResultItem {
  confidence: null | string;
  confirmedAt: null | string;
  confirmedBy: null | string;
  id: string;
  scene: string;
  status: string;
  structuredResult: null | unknown;
  summary: null | string;
}

export interface AiStatsSummary {
  avgDurationMs: number;
  dailyStats: Array<{
    avgDurationMs: number;
    failedCount: number;
    label: string;
    requestCount: number;
    successCount: number;
    totalTokens: number;
  }>;
  failedCount: number;
  requestCount: number;
  sceneStats: Array<{
    failedCount: number;
    requestCount: number;
    scene: string;
    successCount: number;
    totalTokens: number;
  }>;
  successCount: number;
  totalTokens: number;
}

export interface AiPolicyCollectSearchInput {
  bizId: string;
  departmentName?: null | string;
  jobId: string;
  jobName: string;
  keywords: string[];
  officialDomainRules?: null | string;
  policyCategory: string;
  policyCategoryName: string;
  projectName: string;
  publishDateEnd: string;
  publishDateStart: string;
  regionName: string;
  regionScope: string;
  searchResults?: AiPolicyCollectSearchSource[];
  searchTaskId?: null | string;
  systemDate: string;
}

export interface AiPolicyCollectOfficialSearchInput {
  bizId: string;
  jobId: string;
  jobName: string;
  keywords: string[];
  officialDomainRules?: null | string;
  policyCategory: string;
  policyCategoryName: string;
  projectName: string;
  publishDateEnd: string;
  publishDateStart: string;
  queries: string[];
  regionName: string;
  regionScope: string;
  systemDate: string;
}

export interface AiPolicyCollectSearchSource {
  officialLikely?: boolean;
  officialReason?: null | string;
  publishDate?: null | string;
  query?: null | string;
  snippet: string;
  source?: null | string;
  title: string;
  url: string;
}

export interface AiPolicyCollectSearchItem {
  aiReason?: null | string;
  documentNo?: null | string;
  issuingAgency?: null | string;
  officialConfidence?: null | string;
  officialUrl?: null | string;
  officialVerified?: boolean | number;
  publishDate?: null | string;
  rawText?: null | string;
  structuredResult?: null | Record<string, unknown>;
  summary?: null | string;
  title?: null | string;
}

export interface AiPolicyCollectSearchResult {
  items: AiPolicyCollectSearchItem[];
  model: string;
  rawContent: string;
  taskId: string;
  tokenUsage: null | unknown;
}

export interface AiPolicyCollectOfficialSearchResult {
  model: string;
  rawContent: string;
  results: AiPolicyCollectSearchSource[];
  taskId: string;
  tokenUsage: null | unknown;
  warnings: string[];
}

export interface AiSearchHealthCheckResult {
  checkedAt: string;
  currentDate: string;
  model: string;
  rawContent: string;
  searchAvailable: boolean;
  sources: Array<{
    snippet?: null | string;
    title?: null | string;
    url: string;
  }>;
  taskId: string;
  tokenUsage: null | unknown;
  warnings: string[];
}

export interface AiPolicyFileDraftParseInput {
  content?: null | string;
  fileUrl?: null | string;
  officialFileUrl?: null | string;
  policyCategory?: null | string;
  projectName?: null | string;
  regionName?: null | string;
  title?: null | string;
}

export interface AiPolicyFileDraftParseResult {
  confidence: null | string;
  fetchedContent: null | string;
  fetchedUrl: null | string;
  model: string;
  rawContent: string;
  structuredResult: {
    applicationLevel?: null | string;
    conditions?: string[];
    department?: null | string;
    endDate?: null | string;
    materials?: string[];
    policyName?: null | string;
    startDate?: null | string;
    subsidy?: null | string;
    summary?: null | string;
    targetObjects?: string[];
  };
  summary: null | string;
  taskId: string;
  tokenUsage: null | unknown;
}
