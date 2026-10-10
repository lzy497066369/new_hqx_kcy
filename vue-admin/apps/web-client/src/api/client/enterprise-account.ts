import { requestClient } from '#/api/request';

export enum EnterpriseAccountType {
  HighTech = 1,
  NationalSecurity = 2,
  SoftwareCopyright = 3,
  CopyrightProtection = 4,
  NationalTax = 5,
  ProvincialInnovationPlatform = 6,
  IntellectualPropertyPlatform = 7,
}

export enum EnterpriseAccountStatus {
  Disabled = 0,
  Enabled = 1,
}

export namespace ClientEnterpriseAccountApi {
  export interface ClientEnterpriseAccount {
    [key: string]: unknown;
    b_email?: null | string;
    b_phone?: null | string;
    charge?: null | string;
    end_date?: null | string;
    gsbm?: null | string;
    id: string;
    pt_name: string;
    pt_url?: null | string;
    remark?: null | string;
    zh_number: string;
    zh_password?: null | string;
    zh_status: EnterpriseAccountStatus | number | string;
    zh_type: EnterpriseAccountType | number | string;
  }

  export interface GetClientEnterpriseAccountsParams {
    keyword?: string;
    zh_status?: EnterpriseAccountStatus | number;
    zh_type?: EnterpriseAccountType | number;
  }

  export interface SaveClientEnterpriseAccountParams {
    b_email?: null | string;
    b_phone?: null | string;
    charge?: null | string;
    end_date?: null | string;
    gsbm?: null | string;
    pt_name: string;
    pt_url?: null | string;
    remark?: null | string;
    zh_number: string;
    zh_password?: null | string;
    zh_status: EnterpriseAccountStatus | number;
    zh_type: EnterpriseAccountType | number;
  }
}

async function getClientEnterpriseAccountsApi(
  params?: ClientEnterpriseAccountApi.GetClientEnterpriseAccountsParams,
) {
  return requestClient.get<ClientEnterpriseAccountApi.ClientEnterpriseAccount[]>(
    '/client/enterprise/accounts',
    { params },
  );
}

async function getClientEnterpriseAccountDetailApi(id: string) {
  return requestClient.get<ClientEnterpriseAccountApi.ClientEnterpriseAccount>(
    `/client/enterprise/accounts/${id}`,
  );
}

async function createClientEnterpriseAccountApi(
  data: ClientEnterpriseAccountApi.SaveClientEnterpriseAccountParams,
) {
  return requestClient.post<ClientEnterpriseAccountApi.ClientEnterpriseAccount>(
    '/client/enterprise/accounts',
    data,
  );
}

async function updateClientEnterpriseAccountApi(
  id: string,
  data: ClientEnterpriseAccountApi.SaveClientEnterpriseAccountParams,
) {
  return requestClient.put<ClientEnterpriseAccountApi.ClientEnterpriseAccount>(
    `/client/enterprise/accounts/${id}`,
    data,
  );
}

async function deleteClientEnterpriseAccountApi(id: string) {
  return requestClient.delete<void>(`/client/enterprise/accounts/${id}`);
}

export {
  createClientEnterpriseAccountApi,
  deleteClientEnterpriseAccountApi,
  getClientEnterpriseAccountDetailApi,
  getClientEnterpriseAccountsApi,
  updateClientEnterpriseAccountApi,
};
