import { requestClient } from '#/api/request';

export interface ClientCompany {
  creditCode?: null | string;
  id: string;
  industry?: null | string;
  isCurrent?: boolean;
  isDefault?: boolean;
  name: string;
  profileStatus?: string;
  roleName?: string;
  shortName?: null | string;
  status?: 0 | 1;
}

export async function getCurrentClientCompanyApi() {
  return requestClient.get<ClientCompany | null>('/client/companies/current');
}
