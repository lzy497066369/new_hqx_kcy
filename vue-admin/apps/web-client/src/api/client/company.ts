import { requestClient } from '#/api/request';

export namespace ClientCompanyApi {
  export interface HighTechProgress {
    percent: number;
    stages: {
      key: string;
      title: string;
      weight: number;
      percent: number;
      completed: number;
      total: number;
    }[];
  }

  export interface ClientCompany {
    [key: string]: unknown;
    creditCode?: null | string;
    salesOwner?: null | string;
    projectLeader?: null | string;
    highTechProgress?: HighTechProgress | null;
    highTechSelfScore?: number | null;
    preDeclarationYear?: null | number;
    enterpriseProjects?: null | string[];
    id: string;
    industry?: null | string;
    isCurrent?: boolean;
    isDefault?: boolean;
    name: string;
    profileStatus?: null | string;
    roleName?: null | string;
    shortName?: null | string;
    status?: 0 | 1;
  }

  export interface SwitchCurrentCompanyParams {
    companyId: string;
  }
}

async function getClientCompaniesApi() {
  return requestClient.get<ClientCompanyApi.ClientCompany[]>(
    '/client/companies',
  );
}

async function getCurrentClientCompanyApi() {
  return requestClient.get<ClientCompanyApi.ClientCompany | null>(
    '/client/companies/current',
  );
}

async function switchCurrentClientCompanyApi(
  data: ClientCompanyApi.SwitchCurrentCompanyParams,
) {
  // TODO: 后端若切换参数命名为 enterpriseId，在本文件统一适配，避免页面散写 URL。
  return requestClient.put<ClientCompanyApi.ClientCompany>(
    '/client/companies/current',
    data,
  );
}

export {
  getClientCompaniesApi,
  getCurrentClientCompanyApi,
  switchCurrentClientCompanyApi,
};
