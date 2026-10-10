import { requestClient } from '#/api/request';

export type PolicyRegionLevel = 'city' | 'district' | 'province';

export interface PolicyRegionItem {
  children?: PolicyRegionItem[];
  createTime: string;
  id: string;
  level: PolicyRegionLevel;
  name: string;
  parentId: null | string;
  remark: null | string;
  sortNum: number;
  status: number;
  updateTime: string;
}

export interface PolicyRegionQuery {
  level?: PolicyRegionLevel | string;
  name?: string;
  status?: number | string;
}

export interface PolicyRegionForm {
  level: PolicyRegionLevel;
  name: string;
  parentId?: null | string;
  remark?: null | string;
  sortNum?: number;
  status?: number;
}

export type PolicyRegionUpdateForm = Partial<PolicyRegionForm>;

export function getPolicyRegionsApi(params?: PolicyRegionQuery) {
  return requestClient.get<PolicyRegionItem[]>('/policy/regions', { params });
}

export function getPolicyRegionTreeApi(params?: PolicyRegionQuery) {
  return requestClient.get<PolicyRegionItem[]>('/policy/regions/tree', {
    params,
  });
}

export function createPolicyRegionApi(data: PolicyRegionForm) {
  return requestClient.post<PolicyRegionItem>('/policy/regions', data);
}

export function updatePolicyRegionApi(id: string, data: PolicyRegionUpdateForm) {
  return requestClient.put<PolicyRegionItem>(`/policy/regions/${id}`, data);
}

export function deletePolicyRegionApi(id: string) {
  return requestClient.delete(`/policy/regions/${id}`);
}
