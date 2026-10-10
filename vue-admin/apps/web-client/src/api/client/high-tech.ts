import type { MaterialWorkspace } from '../../views/client/high-tech-application/materials/workspace';
import { requestClient } from '#/api/request';
import type { NameGeneration } from './high-tech-names';
export type { NameGeneration } from './high-tech-names';

export type HighTechScores = Record<
  | 'intellectualProperty'
  | 'transformation'
  | 'organization'
  | 'salesGrowth'
  | 'netAssetGrowth',
  number | null
>;
export interface HighTechProject {
  id: string;
  rdNumber: string;
  year: number | null;
  activityName: string;
  researchPeriod: string;
  ipNumber: string;
  ipName: string;
  authorizationNumber: string;
  applicationDate: string;
  authorizationDate: string;
  ipType: string;
  acquisitionMethod: string;
  psNumber: string;
  psName?: string;
  achievementNumber: string;
  achievementName: string;
  techField: string;
}
export interface HighTechMaterial {
  key: 'research' | 'property' | 'transformation' | 'organization' | 'growth';
  content: string;
  reviewed: boolean;
}
export type BookKey = 'profile' | 'main' | 'ip' | 'hr' | 'rd' | 'fee' | 'ps' | 'innovation_ip' | 'innovation_transform' | 'innovation_organization' | 'innovation_staff' | 'standards';
export type AttachmentKey = 'cover' | 'application_pdf' | 'business_license' | 'ip' | 'staff_statement' | 'rd_project_table' | 'rd_expense_audit' | 'hitech_products' | 'hitech_income_audit' | 'achievement_transform' | 'system_docs' | 'annual_audit' | 'tax_settlement' | 'commitment';
export interface HighTechBookSection { key: BookKey; content: string; reviewed: boolean }
export interface HighTechAttachmentNote { key: AttachmentKey; note: string; content: string; reviewed: boolean }
export interface HighTechAttachment { id: string; category: AttachmentKey; name: string; size: number; createdAt: string; order: number; reference?: string; mime?: string; extension?: string }
export interface HighTechIpItem {
  id: string;
  number: string;
  name: string;
  patentType: string;
  legalStatus: string;
  patentNumber: string;
  patentee: string;
  grantDate: string;
  applicationDate: string;
}
export interface HighTechBasicInfo {
  salesRevenue: number | null;
  employeeCount: number | null;
  insuredEmployeeCount: number | null;
  patentCount: number | null;
  inventionPatentCount: number | null;
  utilityModelCount: number | null;
  softwareCopyrightCount: number | null;
  hasRdExpenses: boolean | null;
}
export interface HighTechDraft {
  workspace?: MaterialWorkspace;
  basicInfo: HighTechBasicInfo;
  currentStep: number;
  revision: number;
  scores: HighTechScores;
  projects: HighTechProject[];
  ipSummary: HighTechIpItem[];
  materials: HighTechMaterial[];
  book: HighTechBookSection[];
  attachments: HighTechAttachmentNote[];
  nameGeneration?: NameGeneration;
}
export interface HighTechApplication extends HighTechDraft {
  companyId: string;
  companyName: string;
  updatedAt: string | null;
}
export type HighTechSelfAssessment = Pick<HighTechApplication, 'companyId' | 'companyName' | 'scores' | 'revision' | 'updatedAt'>;
export interface IpAllocationPreview {
  strategy: 'spread_then_similar';
  assignments: {
    ipId: string; projectId: string; rdNumber: string;
    timing: 'within' | 'after'; round: 'spread' | 'append'; reason: string; similarNames: string[];
  }[];
  nameGroups: { id: string; names: string[]; reason: string }[];
  preserved: string[];
  unassigned: { ipId: string; reason: string }[];
  warnings: string[];
  distribution: { projectId: string; rdNumber: string; existingCount: number; addedCount: number }[];
}
const path = (companyId: string) =>
  `/client/companies/${encodeURIComponent(companyId)}/high-tech-application`;
const blobOptions = { responseType: 'blob' as const, responseReturn: 'body' as const };
export const getHighTechSelfAssessmentApi = (companyId: string) =>
  requestClient.get<HighTechSelfAssessment>(`${path(companyId)}/scores`);
export const saveHighTechSelfAssessmentApi = (companyId: string, input: Pick<HighTechSelfAssessment, 'revision' | 'scores'>) =>
  requestClient.put<HighTechSelfAssessment>(`${path(companyId)}/scores`, input);
export const generateHighTechBookApi = (companyId: string, keys: BookKey[]) =>
  requestClient.post<{ sections: Partial<Record<BookKey, string>> }>(`${path(companyId)}/book/generate`, { keys }, { timeout: 300_000 });
export const generateHighTechAttachmentApi = (companyId: string, key: AttachmentKey) =>
  requestClient.post<{ key: AttachmentKey; content: string }>(`${path(companyId)}/attachments/generate`, { key }, { timeout: 300_000 });
export const exportHighTechBookApi = (companyId: string) => requestClient.get<Blob>(`${path(companyId)}/book/export`, blobOptions);
export const listHighTechAttachmentsApi = (companyId: string) => requestClient.get<HighTechAttachment[]>(`${path(companyId)}/attachments`);
export const uploadHighTechAttachmentApi = (companyId: string, category: AttachmentKey, file: File, reference = '') => {
  const form = new FormData();
  form.append('file', file);
  form.append('reference', reference);
  return requestClient.post<HighTechAttachment>(`${path(companyId)}/attachments/${category}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const getHighTechAttachmentFileApi = (companyId: string, id: string) => requestClient.get<Blob>(`${path(companyId)}/attachments/${id}/file`, blobOptions);
export const deleteHighTechAttachmentApi = (companyId: string, id: string) => requestClient.delete(`${path(companyId)}/attachments/${id}`);
export const reorderHighTechAttachmentsApi = (companyId: string, category: AttachmentKey, ids: string[]) =>
  requestClient.put<HighTechAttachment[]>(`${path(companyId)}/attachments/${category}/order`, { ids });
export const exportHighTechAttachmentPdfApi = (companyId: string) => requestClient.get<Blob>(`${path(companyId)}/attachments/export/pdf`, { ...blobOptions, timeout: 300_000 });
export const exportHighTechMaterialZipApi = (companyId: string) => requestClient.get<Blob>(`${path(companyId)}/attachments/export/zip`, { ...blobOptions, timeout: 300_000 });
export interface HighTechFieldOption {
  id: string;
  label: string;
}
export const getHighTechFieldCatalogApi = (companyId: string) =>
  requestClient.get<{ fields: HighTechFieldOption[] }>(`${path(companyId)}/tech-fields`);
export const recommendHighTechFieldsApi = (companyId: string, patentNames: string[]) =>
  requestClient.post<{ fields: HighTechFieldOption[] }>(`${path(companyId)}/tech-fields/recommend`, { patentNames }, { timeout: 300_000 });
export const getHighTechApplicationApi = (companyId: string) =>
  requestClient.get<HighTechApplication>(path(companyId));
export const saveHighTechApplicationApi = (
  companyId: string,
  draft: HighTechDraft,
) => requestClient.put<HighTechApplication>(path(companyId), draft);
export const previewHighTechIpAllocationApi = (companyId: string, input: Pick<HighTechDraft, 'projects' | 'ipSummary'>) =>
  requestClient.post<IpAllocationPreview>(`${path(companyId)}/ip-allocation/preview`, input, { timeout: 300_000 });
export const generateHighTechNamesApi = (companyId: string, input: Pick<HighTechDraft, 'projects'>) =>
  requestClient.post<NameGeneration>(`${path(companyId)}/names/generate`, input, { timeout: 300_000 });
export const exportHighTechApplicationApi = (companyId: string) =>
  requestClient.get<Blob>(`${path(companyId)}/export`, {
    responseType: 'blob',
    responseReturn: 'body',
  });
export const importHighTechIpSummaryApi = (companyId: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return requestClient.post<{ rows: HighTechIpItem[]; total: number }>(
    `${path(companyId)}/ip-summary/import`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
};
export const exportHighTechIpSummaryApi = (companyId: string, rows: HighTechIpItem[]) =>
  requestClient.post<Blob>(`${path(companyId)}/ip-summary/export`, { rows }, {
    responseType: 'blob',
    responseReturn: 'body',
  });

export const importHighTechProjectDetailsApi = (companyId: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return requestClient.post<{ rows: HighTechProject[]; total: number }>(
    `${path(companyId)}/project-details/import`, form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
};
export const exportHighTechProjectDetailsApi = (companyId: string, rows: HighTechProject[]) =>
  requestClient.post<Blob>(`${path(companyId)}/project-details/export`, { rows }, {
    responseType: 'blob',
    responseReturn: 'body',
  });

export interface RecognizedIpRow extends HighTechIpItem {
}
export const recognizeHighTechIpPdfsApi = (companyId: string, files: File[]) => {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  return requestClient.post<{ rows: RecognizedIpRow[]; errors: string[]; warnings: string[]; total: number }>(
    `${path(companyId)}/ip-summary/recognize-pdfs`, form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300_000 },
  );
};

export const generateHighTechDocumentApi = (companyId: string, key: string, words = 1500) =>
  requestClient.post<{ key: string; content: string; source: string }>(`${path(companyId)}/documents/generate`, { key, words }, { timeout: 300_000 });
export const exportHighTechDocumentApi = (companyId: string, key: string, format: 'word' | 'pdf' | 'zip') =>
  requestClient.post<Blob>(`${path(companyId)}/documents/export`, { key, format }, { ...blobOptions, timeout: 300_000 });

export interface MaterialImportResult { kind: string; year: string; fields?: Record<string, string>; fees?: Record<string, string>[]; products?: Record<string, string>[]; rows?: Record<string, string>[]; file?: HighTechAttachment; source: string }
export const importHighTechMaterialApi = (companyId: string, kind: string, year: number, file: File) => {
  const form = new FormData(); form.append('file', file);
  return requestClient.post<MaterialImportResult>(`${path(companyId)}/materials/import/${encodeURIComponent(kind)}/${year}`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300_000 });
};
export const getHighTechMaterialStaffApi = (companyId: string) => requestClient.get<Record<string, string>[]>(`${path(companyId)}/materials/staff`);
export const exportHighTechMaterialStaffTemplateApi = (companyId: string) =>
  requestClient.get<Blob>(`${path(companyId)}/materials/staff/template`, blobOptions);
