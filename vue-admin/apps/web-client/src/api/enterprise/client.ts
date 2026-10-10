import { requestClient } from '#/api/request';

export interface ClientEnterpriseProfile {
  address?: null | string;
  city?: null | string;
  contactEmail?: null | string;
  contactName?: null | string;
  contactPhone?: null | string;
  createTime?: string;
  creditCode: string;
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

export function getCurrentEnterpriseProfileApi() {
  return requestClient.get<ClientEnterpriseProfile>('/enterprise/client/current');
}
