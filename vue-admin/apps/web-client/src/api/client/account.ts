import { requestClient } from '#/api/request';

export namespace ClientAccountApi {
  export interface ClientMe {
    [key: string]: unknown;
    email?: null | string;
    id: string;
    mobile?: null | string;
    name?: null | string;
    phone?: null | string;
    position?: null | string;
    realName?: null | string;
    roleInCompany?: null | string;
    username?: null | string;
  }

  export interface UpdateClientMeParams {
    email?: null | string;
    mobile?: null | string;
    name?: null | string;
    phone?: null | string;
    position?: null | string;
    realName?: null | string;
    roleInCompany?: null | string;
  }

  export interface BindCompanyParams {
    contactEmail?: null | string;
    contactName?: null | string;
    contactPhone?: null | string;
    creditCode: string;
    enterpriseName: string;
    remark?: null | string;
  }
}

async function getClientMeApi() {
  return requestClient.get<ClientAccountApi.ClientMe>('/client/me');
}

async function updateClientMeApi(data: ClientAccountApi.UpdateClientMeParams) {
  return requestClient.put<ClientAccountApi.ClientMe>('/client/me', data);
}

async function bindClientCompanyApi(data: ClientAccountApi.BindCompanyParams) {
  return requestClient.post<void>('/client/companies/bind', data);
}

export { bindClientCompanyApi, getClientMeApi, updateClientMeApi };
