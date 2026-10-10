import { requestClient } from '#/api/request';

export namespace ClientPolicyApi {
  export type PolicyFileStatus =
    | 'archived'
    | 'draft'
    | 'expired'
    | 'incomplete'
    | 'published';

  export type PolicyRegionLevel = 'city' | 'district' | 'province';

  export interface PolicyFile {
    applicationLevel: null | string;
    conditionText: null | string;
    content: null | string;
    createTime: string;
    endDate: null | string;
    fileName: null | string;
    fileUrl: null | string;
    id: string;
    materialText: null | string;
    officialFileUrl: null | string;
    ownerName: string;
    ownerUserId: string;
    projectId: string;
    projectName: string;
    regionId: string;
    regionName: string;
    remark: null | string;
    startDate: null | string;
    status: PolicyFileStatus;
    subsidyAmountMax: null | string;
    subsidyAmountMin: null | string;
    subsidyText: null | string;
    targetObjects: null | string;
    templateFileId: null | string;
    templateFileName: null | string;
    title: string;
    updateTime: string;
  }

  export interface PolicyFileListParams {
    page?: number;
    pageSize?: number;
    projectId?: string;
    regionId?: string;
    status?: PolicyFileStatus | string;
    title?: string;
  }

  export interface PolicyFileListResult {
    items: PolicyFile[];
    total: number;
  }

  export interface PolicyProject {
    applicableObjects: null | string;
    basicDescription: null | string;
    createTime: string;
    enabled: number;
    id: string;
    name: string;
    policyType: null | string;
    updateTime: string;
  }

  export interface PolicyProjectListParams {
    enabled?: number | string;
    name?: string;
    page?: number;
    pageSize?: number;
    policyType?: string;
  }

  export interface PolicyProjectListResult {
    items: PolicyProject[];
    total: number;
  }

  export interface PolicyRegion {
    children?: PolicyRegion[];
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

  export interface PolicyRegionListParams {
    level?: PolicyRegionLevel | string;
    name?: string;
    status?: number | string;
  }
}

async function getClientPolicyFilesApi(
  params: ClientPolicyApi.PolicyFileListParams = {},
) {
  return requestClient.get<ClientPolicyApi.PolicyFileListResult>(
    '/client/policies',
    {
      params: {
        status: 'published',
        ...params,
      },
    },
  );
}

async function getClientPolicyFileDetailApi(id: string) {
  return requestClient.get<ClientPolicyApi.PolicyFile>(`/client/policies/${id}`);
}

async function getClientPolicyProjectsApi(
  params: ClientPolicyApi.PolicyProjectListParams = {},
) {
  return requestClient.get<ClientPolicyApi.PolicyProjectListResult>(
    '/policy/projects',
    {
      params: {
        enabled: 1,
        ...params,
      },
    },
  );
}

async function getClientPolicyRegionsApi(
  params: ClientPolicyApi.PolicyRegionListParams = {},
) {
  return requestClient.get<ClientPolicyApi.PolicyRegion[]>('/policy/regions', {
    params: {
      status: 1,
      ...params,
    },
  });
}

async function getClientPolicyRegionTreeApi(
  params: ClientPolicyApi.PolicyRegionListParams = {},
) {
  return requestClient.get<ClientPolicyApi.PolicyRegion[]>(
    '/policy/regions/tree',
    {
      params: {
        status: 1,
        ...params,
      },
    },
  );
}

export {
  getClientPolicyFileDetailApi,
  getClientPolicyFilesApi,
  getClientPolicyProjectsApi,
  getClientPolicyRegionsApi,
  getClientPolicyRegionTreeApi,
};
