import { requestClient } from '#/api/request';

export interface ProjectMaterialRequirement {
  createTime: string;
  description: null | string;
  enabled: number;
  id: string;
  projectId: string;
  projectName?: string;
  requirementName: string;
  updateTime: string;
  version: null | string;
}

export interface ProjectMaterialRequirementDetail {
  items: ProjectMaterialRequirementItem[];
  requirement: null | ProjectMaterialRequirement;
}

export interface ProjectMaterialRequirementForm {
  description?: string;
  enabled?: number;
  requirementName: string;
  version?: string;
}

export interface ProjectMaterialRequirementItem {
  attachmentRequired: number;
  enabled: number;
  id: string;
  isRequired: number;
  itemName: string;
  moduleKey: string;
  requirementId: string;
  requiredCount: number;
  requiredFields: string;
  requiredYears: string;
  scoreWeight: number;
  sortOrder: number;
  tabKey: string;
  updateTime: string;
}

export interface ProjectMaterialRequirementItemForm {
  attachmentRequired?: number;
  enabled?: number;
  id?: string;
  isRequired?: number;
  itemName: string;
  moduleKey: string;
  requirementId: string;
  requiredCount: number;
  requiredFields?: string;
  requiredYears?: string;
  scoreWeight?: number;
  sortOrder?: number;
  tabKey: string;
}

export function getProjectMaterialRequirementApi(projectId: string) {
  return requestClient.get<ProjectMaterialRequirementDetail>(
    `/admin/projects/${projectId}/material-requirement`,
  );
}

export function saveProjectMaterialRequirementApi(
  projectId: string,
  data: ProjectMaterialRequirementForm,
) {
  return requestClient.post<ProjectMaterialRequirementDetail>(
    `/admin/projects/${projectId}/material-requirement`,
    data,
  );
}

export function createProjectMaterialRequirementItemApi(
  data: ProjectMaterialRequirementItemForm,
) {
  return requestClient.post<ProjectMaterialRequirementItem>(
    '/admin/project-material-requirement-items',
    data,
  );
}

export function updateProjectMaterialRequirementItemApi(
  id: string,
  data: ProjectMaterialRequirementItemForm,
) {
  return requestClient.put<ProjectMaterialRequirementItem>(
    `/admin/project-material-requirement-items/${id}`,
    data,
  );
}

export function deleteProjectMaterialRequirementItemApi(id: string) {
  return requestClient.delete(`/admin/project-material-requirement-items/${id}`);
}
