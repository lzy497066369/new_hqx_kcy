import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export interface EnterpriseTeacherItem {
  createTime?: string;
  email?: null | string;
  enterpriseId: string;
  enterpriseName: string;
  id: string;
  name: string;
  phone?: null | string;
  remark?: null | string;
  status: 0 | 1;
  teacherUserId: string;
  updateTime?: string;
  username: string;
}

export interface EnterpriseTeacherForm {
  enterpriseId?: string;
  remark?: null | string;
  status?: 0 | 1;
  teacherUserId?: string;
}

export interface EnterpriseTeacherCandidate {
  id: string;
  name: string;
  username: string;
}

export function getEnterpriseTeachersApi(params: Recordable<any>) {
  return requestClient.get<{ items: EnterpriseTeacherItem[]; total: number }>(
    '/enterprise/teacher/list',
    { params },
  );
}

export function getEnterpriseTeacherDetailApi(id: string) {
  return requestClient.get<EnterpriseTeacherItem>(`/enterprise/teacher/${id}`);
}

export function getEnterpriseTeacherCandidatesApi() {
  return requestClient.get<EnterpriseTeacherCandidate[]>(
    '/enterprise/teacher/candidates',
  );
}

export function createEnterpriseTeacherApi(data: EnterpriseTeacherForm) {
  return requestClient.post<EnterpriseTeacherItem>('/enterprise/teacher', data);
}

export function updateEnterpriseTeacherApi(
  id: string,
  data: EnterpriseTeacherForm,
) {
  return requestClient.put<EnterpriseTeacherItem>(
    `/enterprise/teacher/${id}`,
    data,
  );
}

export function deleteEnterpriseTeacherApi(id: string) {
  return requestClient.delete(`/enterprise/teacher/${id}`);
}
