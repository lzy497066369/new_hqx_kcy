import { requestClient } from '#/api/request';

export namespace ClientMaterialApi {
  export interface ClientMaterialTemplate {
    [key: string]: unknown;
    description?: null | string;
    fileName?: null | string;
    id: string;
    materialType?: null | string;
    name: string;
    required?: boolean;
    updateTime?: string;
    version?: null | string;
  }

  export interface ClientMaterialRecord {
    [key: string]: unknown;
    errorCount?: number;
    fileName?: null | string;
    id: string;
    importSummary?: null | {
      employeeCount?: number;
      errorCount?: number;
      financialCount?: number;
      status?: string;
      successCount?: number;
      taxAuditCount?: number;
    };
    materialType?: null | string;
    remark?: null | string;
    status: 'invalid' | 'not_uploaded' | 'uploaded' | 'valid' | string;
    templateId?: null | string;
    templateName?: null | string;
    uploadTime?: string;
  }

  export interface ClientMaterialError {
    [key: string]: unknown;
    fieldName?: null | string;
    id: string;
    message: string;
    rowNumber?: null | number;
  }
}

async function getClientMaterialTemplatesApi() {
  return requestClient.get<ClientMaterialApi.ClientMaterialTemplate[]>(
    '/client/material-templates',
  );
}

async function downloadClientMaterialTemplateApi(id: string) {
  return requestClient.get<Blob>(`/client/material-templates/${id}/download`, {
    responseType: 'blob',
  });
}

async function uploadClientMaterialApi(templateId: string, file: File) {
  const data = new FormData();
  data.append('templateId', templateId);
  data.append('file', file);

  return requestClient.post<ClientMaterialApi.ClientMaterialRecord>(
    '/client/materials/upload',
    data,
  );
}

async function getClientMaterialsApi() {
  return requestClient.get<ClientMaterialApi.ClientMaterialRecord[]>(
    '/client/materials',
  );
}

async function getClientMaterialErrorsApi(id: string) {
  return requestClient.get<ClientMaterialApi.ClientMaterialError[]>(
    `/client/materials/${id}/errors`,
  );
}

export {
  downloadClientMaterialTemplateApi,
  getClientMaterialErrorsApi,
  getClientMaterialsApi,
  getClientMaterialTemplatesApi,
  uploadClientMaterialApi,
};
