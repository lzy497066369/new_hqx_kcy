import { requestClient } from '#/api/request';

export namespace ClientEnterpriseApi {
  export interface ClientEnterpriseProfile {
    [key: string]: unknown;
    address?: null | string;
    city?: null | string;
    contactEmail?: null | string;
    contactName?: null | string;
    contactPhone?: null | string;
    createTime?: string;
    creditCode?: null | string;
    district?: null | string;
    enterpriseType?: null | string;
    id: string;
    industry?: null | string;
    legalPerson?: null | string;
    name: string;
    profileStatus?: null | string;
    province?: null | string;
    remark?: null | string;
    shortName?: null | string;
    source?: null | string;
    status?: 0 | 1;
    updateTime?: string;
  }

  export interface UpdateClientEnterpriseProfileParams {
    address?: null | string;
    city?: null | string;
    contactEmail?: null | string;
    contactName?: null | string;
    contactPhone?: null | string;
    creditCode?: null | string;
    district?: null | string;
    enterpriseType?: null | string;
    industry?: null | string;
    legalPerson?: null | string;
    name?: null | string;
    province?: null | string;
    remark?: null | string;
    shortName?: null | string;
  }

  export interface ClientEnterpriseContact {
    [key: string]: unknown;
    email?: null | string;
    id: string;
    isDefault?: boolean;
    name: string;
    phone?: null | string;
    position?: null | string;
    remark?: null | string;
    roleName?: null | string;
  }

  export interface SaveClientEnterpriseContactParams {
    email?: null | string;
    isDefault?: boolean;
    name: string;
    phone?: null | string;
    position?: null | string;
    remark?: null | string;
    roleName?: null | string;
  }

  export type ShareholderCitizenType = 1 | 2 | 3;

  export interface ClientEnterpriseShareholder {
    citizen_type?: null | ShareholderCitizenType;
    id?: string;
    idcard?: null | string;
    invest_money?: null | number;
    xname?: null | string;
  }

  export interface ClientEnterpriseBasicProfile {
    company_address?: null | string;
    company_name?: null | string;
    companyIntro?: null | string;
    contacts_email?: null | string;
    contacts_fax?: null | string;
    contacts_idcard?: null | string;
    contacts_mobile?: null | string;
    contacts_name?: null | string;
    contacts_phone?: null | string;
    is_invest?: 0 | 1 | null;
    is_ipo?: 0 | 1 | null;
    js_areas?: null | string;
    le_person_idcard?: null | string;
    le_person_name?: null | string;
    le_person_phone?: null | string;
    listedCode?: null | string;
    main_areas?: null | string | string[];
    register_capital?: null | number;
    register_date?: null | string;
    register_type?: null | string;
    shareholders?: ClientEnterpriseShareholder[];
    tax_id?: null | string;
    vcAmount?: null | number;
    zip_code?: null | string;
  }
}

async function getClientEnterpriseProfileApi() {
  return requestClient.get<ClientEnterpriseApi.ClientEnterpriseProfile>(
    '/client/enterprise/profile',
  );
}

async function updateClientEnterpriseProfileApi(
  data: ClientEnterpriseApi.UpdateClientEnterpriseProfileParams,
) {
  return requestClient.put<ClientEnterpriseApi.ClientEnterpriseProfile>(
    '/client/enterprise/profile',
    data,
  );
}

async function getClientEnterpriseContactsApi() {
  return requestClient.get<ClientEnterpriseApi.ClientEnterpriseContact[]>(
    '/client/enterprise/contacts',
  );
}

async function createClientEnterpriseContactApi(
  data: ClientEnterpriseApi.SaveClientEnterpriseContactParams,
) {
  return requestClient.post<ClientEnterpriseApi.ClientEnterpriseContact>(
    '/client/enterprise/contacts',
    data,
  );
}

async function updateClientEnterpriseContactApi(
  id: string,
  data: ClientEnterpriseApi.SaveClientEnterpriseContactParams,
) {
  return requestClient.put<ClientEnterpriseApi.ClientEnterpriseContact>(
    `/client/enterprise/contacts/${id}`,
    data,
  );
}

async function getClientEnterpriseBasicProfileApi() {
  return requestClient.get<ClientEnterpriseApi.ClientEnterpriseBasicProfile>(
    '/client/enterprise/basic-profile',
  );
}

async function updateClientEnterpriseBasicProfileApi(
  data: ClientEnterpriseApi.ClientEnterpriseBasicProfile,
) {
  return requestClient.put<ClientEnterpriseApi.ClientEnterpriseBasicProfile>(
    '/client/enterprise/basic-profile',
    data,
  );
}

async function createClientEnterpriseShareholderApi(
  data: ClientEnterpriseApi.ClientEnterpriseShareholder,
) {
  return requestClient.post<ClientEnterpriseApi.ClientEnterpriseShareholder>(
    '/client/enterprise/basic-profile/shareholders',
    data,
  );
}

async function getClientEnterpriseShareholdersApi() {
  return requestClient.get<ClientEnterpriseApi.ClientEnterpriseShareholder[]>(
    '/client/enterprise/basic-profile/shareholders',
  );
}

async function updateClientEnterpriseShareholderApi(
  id: string,
  data: ClientEnterpriseApi.ClientEnterpriseShareholder,
) {
  return requestClient.put<ClientEnterpriseApi.ClientEnterpriseShareholder>(
    `/client/enterprise/basic-profile/shareholders/${id}`,
    data,
  );
}

async function deleteClientEnterpriseShareholderApi(id: string) {
  return requestClient.delete<void>(
    `/client/enterprise/basic-profile/shareholders/${id}`,
  );
}

export {
  createClientEnterpriseShareholderApi,
  createClientEnterpriseContactApi,
  deleteClientEnterpriseShareholderApi,
  getClientEnterpriseBasicProfileApi,
  getClientEnterpriseContactsApi,
  getClientEnterpriseProfileApi,
  getClientEnterpriseShareholdersApi,
  updateClientEnterpriseBasicProfileApi,
  updateClientEnterpriseContactApi,
  updateClientEnterpriseProfileApi,
  updateClientEnterpriseShareholderApi,
};
