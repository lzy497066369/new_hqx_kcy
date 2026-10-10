import { requestClient } from '#/api/request';

export interface EnterpriseImportSearchItem {
  address?: null | string;
  creditCode?: null | string;
  establishTime?: null | string;
  externalId: string;
  legalPerson?: null | string;
  name: string;
  raw: Record<string, unknown>;
  regStatus?: null | string;
}

export interface EnterpriseImportPreviewEnterprise {
  address?: null | string;
  alias?: null | string;
  businessScope?: null | string;
  city?: null | string;
  companyOrgType?: null | string;
  creditCode?: null | string;
  district?: null | string;
  email?: null | string;
  establishTime?: null | string;
  externalId: string;
  industry?: null | string;
  legalPerson?: null | string;
  name: string;
  phoneNumber?: null | string;
  province?: null | string;
  regCapital?: null | string;
  regInstitute?: null | string;
  regLocation?: null | string;
  regStatus?: null | string;
  websites: string[];
}

export interface EnterpriseImportPreviewPerson {
  accountCreated: boolean;
  email?: null | string;
  id: string;
  isLegalPerson: boolean;
  name: string;
  personType: string;
  phone?: null | string;
  position: string;
  selectedByDefault: boolean;
}

export interface EnterpriseImportPreviewResponse {
  existingEnterprise: null | {
    creditCode?: null | string;
    id: string;
    name: string;
  };
  enterprise: EnterpriseImportPreviewEnterprise;
  persons: EnterpriseImportPreviewPerson[];
}

export interface EnterpriseImportConfirmPayload {
  createAccounts: boolean;
  defaultPassword: string;
  externalId: string;
  selectedPersonIds: string[];
}

export interface EnterpriseImportConfirmResponse {
  createAccounts: boolean;
  createdOwnerCount: number;
  createdUserCount: number;
  defaultPassword: string;
  enterpriseId: string;
  enterpriseName: string;
  existed: boolean;
  message: string;
}

async function searchEnterpriseImportApi(keyword: string) {
  return requestClient.get<{
    items: EnterpriseImportSearchItem[];
  }>('/enterprise/import/search', {
    params: {
      keyword,
    },
  });
}

async function previewEnterpriseImportApi(externalId: string) {
  return requestClient.get<EnterpriseImportPreviewResponse>(
    '/enterprise/import/preview',
    {
      params: {
        externalId,
      },
    },
  );
}

async function confirmEnterpriseImportApi(data: EnterpriseImportConfirmPayload) {
  return requestClient.post<EnterpriseImportConfirmResponse>(
    '/enterprise/import/confirm',
    data,
  );
}

export {
  confirmEnterpriseImportApi,
  previewEnterpriseImportApi,
  searchEnterpriseImportApi,
};
