import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export interface EnterpriseProfileItem {
  address?: null | string;
  city?: null | string;
  contactEmail?: null | string;
  contactName?: null | string;
  contactPhone?: null | string;
  createTime?: string;
  creditCode: string;
  declarationProjects: string[];
  district?: null | string;
  enterpriseType?: null | string;
  id: string;
  industry?: null | string;
  legalPerson?: null | string;
  name: string;
  profileStatus: string;
  province?: null | string;
  remark?: null | string;
  shortName?: null | string;
  source?: null | string;
  status: 0 | 1;
  updateTime?: string;
}

export type EnterpriseProfileForm = Omit<
  EnterpriseProfileItem,
  'createTime' | 'declarationProjects' | 'id' | 'updateTime'
>;

async function getEnterpriseProfilesApi(params: Recordable<any>) {
  return requestClient.get<{
    items: EnterpriseProfileItem[];
    total: number;
  }>('/enterprise/profile/list', {
    params,
  });
}

async function getEnterpriseProfileDetailApi(id: string) {
  return requestClient.get<EnterpriseProfileItem>(`/enterprise/profile/${id}`);
}

async function createEnterpriseProfileApi(data: EnterpriseProfileForm) {
  return requestClient.post('/enterprise/profile', data);
}

async function updateEnterpriseProfileApi(
  id: string,
  data: EnterpriseProfileForm,
) {
  return requestClient.put(`/enterprise/profile/${id}`, data);
}

async function deleteEnterpriseProfileApi(id: string) {
  return requestClient.delete(`/enterprise/profile/${id}`);
}

export {
  createEnterpriseProfileApi,
  deleteEnterpriseProfileApi,
  getEnterpriseProfileDetailApi,
  getEnterpriseProfilesApi,
  updateEnterpriseProfileApi,
  downloadEnterpriseProfileExcelTemplateApi,
  downloadEnterpriseProfileExcelApi,
  importEnterpriseProfileExcelApi,
};


export interface EnterpriseProfileExcelImportRow {
  enterpriseId?: string;
  enterpriseName: string;
  issues: string[];
  rowNumber: number;
  status: 'duplicate' | 'error' | 'success';
}

export interface EnterpriseProfileExcelImportResult {
  rows: EnterpriseProfileExcelImportRow[];
  total: number;
  success: number;
  duplicate: number;
  failed: number;
}

async function downloadEnterpriseProfileExcelTemplateApi() {
  return requestClient.get<Blob>('/enterprise/profile/excel/template', {
    responseReturn: 'body',
    responseType: 'blob',
  });
}

async function downloadEnterpriseProfileExcelApi() {
  return requestClient.get<Blob>('/enterprise/profile/excel/export', {
    responseReturn: 'body',
    responseType: 'blob',
  });
}

async function importEnterpriseProfileExcelApi(file: File) {
  const data = new FormData();
  data.append('file', file);
  return requestClient.post<EnterpriseProfileExcelImportResult>(
    '/enterprise/profile/excel/import',
    data,
    { timeout: 120_000 },
  );
}
