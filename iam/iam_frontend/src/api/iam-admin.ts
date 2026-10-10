import { requestClient } from '#/api/request';

export interface IamApp {
  appCode: string;
  appName: string;
  appType: string;
  companySourceSystem: null | string;
  homePath: null | string;
  id: string;
  portalType: string;
  remark: null | string;
  status: number;
}

export interface IamUser {
  avatarPath: null | string;
  email: null | string;
  id: string;
  phone: null | string;
  realName: string;
  remark: null | string;
  status: number;
  username: string;
}

export interface IamCompany {
  city: null | string;
  companyName: string;
  contactName: null | string;
  contactPhone: null | string;
  creditCode: null | string;
  district: null | string;
  id: string;
  legalPerson: null | string;
  province: null | string;
  shortName: null | string;
  sourceCompanyId: null | string;
  sourceSystem: null | string;
  status: number;
}

export interface IamCompanyMember {
  appCode: string;
  companyId: string;
  dataScope?: string;
  id: string;
  isDefault: number;
  isPrimary: number;
  memberType: 'employee' | 'owner' | 'project_teacher';
  realName: null | string;
  status: number;
  userId: string;
  username: null | string;
}

export interface IamPlatformDepartment {
  deptCode: string;
  deptName: string;
  id: string;
  leaderRealName?: null | string;
  leaderUserId: null | string;
  memberCount?: number;
  parentId: null | string;
  remark: null | string;
  sortOrder: number;
  status: number;
}

export interface IamUserPlatformDepartment {
  departmentId: string;
  id: string;
  isPrimary: number;
  realName: null | string;
  status: number;
  userId: string;
  username: null | string;
}

export interface IamRole { appCode: string; id: string; remark: null | string; roleCode: string; roleName: string; roleType: string; status: number; }
export interface IamPermission { appCode: string; id: string; permissionCode: string; permissionName: string; resourceType: string; status: number; }
export interface IamMenu { authCode: null | string; component: null | string; id: string; menuName: string; menuType: string; meta: Record<string, unknown>; parentId: null | string; path: null | string; redirect: null | string; sortOrder: number; status: number; }
export interface IamUserApp { appCode: string; homePath: null | string; id: string; status: number; userId: string; }
export interface IamOAuthClient { accessTokenTtl: number; appCode: string; clientId: string; clientType: 'confidential' | 'public'; grantTypes: string[]; id: string; postLogoutRedirectUris: null | string[]; redirectUris: string[]; refreshTokenTtl: number; status: number; }
export interface IamAuditEvent { action: string; actorUserId: null | string; appCode: null | string; clientId: null | string; createdAt: string; details: null | Record<string, unknown>; eventType: string; id: string; ipAddress: null | string; outcome: 'failure' | 'success'; username: null | string; }
export interface IamAuditListResult { items: IamAuditEvent[]; limit: number; page: number; total: number; }
export interface IamAuditQuery { action?: string; endAt?: string; limit?: number; outcome?: IamAuditEvent['outcome']; page?: number; startAt?: string; username?: string; }
export interface IamOAuthClientInput { accessTokenTtl?: number; clientId: string; clientType: IamOAuthClient['clientType']; grantTypes: string[]; postLogoutRedirectUris?: string[]; redirectUris: string[]; refreshTokenTtl?: number; secret?: string; status?: number; }

type ListResult<T> = { items: T[]; total: number };

export const listAppsApi = () => requestClient.get<ListResult<IamApp>>('/iam/admin/apps');
export const createAppApi = (data: Omit<IamApp, 'id'>) => requestClient.post<IamApp>('/iam/admin/apps', data);
export const updateAppApi = (id: string, data: Omit<IamApp, 'id'>) => requestClient.put<IamApp>(`/iam/admin/apps/${id}`, data);
export const listUsersApi = () => requestClient.get<ListResult<IamUser>>('/iam/admin/users');
export const createUserApi = (data: Omit<IamUser, 'id'> & { password: string }) => requestClient.post<IamUser>('/iam/admin/users', data);
export const updateUserApi = (id: string, data: Omit<IamUser, 'id'> & { password?: string }) => requestClient.put<IamUser>(`/iam/admin/users/${id}`, data);
export const listUserAppsApi = (userId: string) => requestClient.get<ListResult<IamUserApp>>(`/iam/admin/users/${userId}/apps`);
export const grantUserAppApi = (userId: string, appCode: string, data: Pick<IamUserApp, 'homePath' | 'status'>) => requestClient.put<IamUserApp>(`/iam/admin/users/${userId}/apps/${appCode}`, data);
export const listUserRoleIdsApi = (userId: string, appCode: string) => requestClient.get<{ roleIds: string[] }>(`/iam/admin/users/${userId}/apps/${appCode}/roles`);
export const setUserRolesApi = (userId: string, appCode: string, roleIds: string[]) => requestClient.put<{ roleIds: string[] }>(`/iam/admin/users/${userId}/apps/${appCode}/roles`, { roleIds });
export const listCompaniesApi = () => requestClient.get<ListResult<IamCompany>>('/iam/admin/companies');
export const listCompanyMembersApi = (companyId: string, appCode: string) => requestClient.get<ListResult<IamCompanyMember>>(`/iam/admin/companies/${companyId}/members`, { params: { appCode } });
export interface IamCompanyMemberInput {
  appCode: string;
  dataScope: 'all' | 'assigned';
  isDefault: boolean;
  isPrimary: boolean;
  memberType: IamCompanyMember['memberType'];
  status?: number;
  userId: string;
}

export const upsertCompanyMemberApi = (companyId: string, data: IamCompanyMemberInput) => requestClient.put<IamCompanyMember>(`/iam/admin/companies/${companyId}/members`, data);
export const listPlatformDepartmentsApi = () => requestClient.get<ListResult<IamPlatformDepartment>>('/iam/admin/platform-departments');
export const createPlatformDepartmentApi = (data: Omit<IamPlatformDepartment, 'id' | 'leaderRealName' | 'memberCount'>) => requestClient.post<IamPlatformDepartment>('/iam/admin/platform-departments', data);
export const updatePlatformDepartmentApi = (id: string, data: Omit<IamPlatformDepartment, 'id' | 'leaderRealName' | 'memberCount'>) => requestClient.put<IamPlatformDepartment>(`/iam/admin/platform-departments/${id}`, data);
export const listPlatformDepartmentMembersApi = (departmentId: string) => requestClient.get<ListResult<IamUserPlatformDepartment>>(`/iam/admin/platform-departments/${departmentId}/members`);
export const upsertPlatformDepartmentMemberApi = (departmentId: string, data: { isPrimary: boolean; status: number; userId: string }) => requestClient.put<IamUserPlatformDepartment>(`/iam/admin/platform-departments/${departmentId}/members`, data);
export const listRolesApi = (appCode: string) => requestClient.get<ListResult<IamRole>>(`/iam/admin/apps/${appCode}/roles`);
export const createRoleApi = (appCode: string, data: Omit<IamRole, 'appCode' | 'id'>) => requestClient.post<IamRole>(`/iam/admin/apps/${appCode}/roles`, data);
export const updateRoleApi = (appCode: string, roleId: string, data: Omit<IamRole, 'appCode' | 'id'>) => requestClient.put<IamRole>(`/iam/admin/apps/${appCode}/roles/${roleId}`, data);
export const listRolePermissionIdsApi = (appCode: string, roleId: string) => requestClient.get<{ permissionIds: string[] }>(`/iam/admin/apps/${appCode}/roles/${roleId}/permissions`);
export const setRolePermissionsApi = (appCode: string, roleId: string, permissionIds: string[]) => requestClient.put(`/iam/admin/apps/${appCode}/roles/${roleId}/permissions`, { permissionIds });
export const listPermissionsApi = (appCode: string) => requestClient.get<ListResult<IamPermission>>(`/iam/admin/apps/${appCode}/permissions`);
export const createPermissionApi = (appCode: string, data: Omit<IamPermission, 'appCode' | 'id'>) => requestClient.post<IamPermission>(`/iam/admin/apps/${appCode}/permissions`, data);
export const updatePermissionApi = (appCode: string, permissionId: string, data: Omit<IamPermission, 'appCode' | 'id'>) => requestClient.put<IamPermission>(`/iam/admin/apps/${appCode}/permissions/${permissionId}`, data);
export const listMenusApi = (appCode: string) => requestClient.get<ListResult<IamMenu>>(`/iam/admin/apps/${appCode}/menus`);
export const createMenuApi = (appCode: string, data: Omit<IamMenu, 'id'>) => requestClient.post<IamMenu>(`/iam/admin/apps/${appCode}/menus`, data);
export const updateMenuApi = (appCode: string, menuId: string, data: Omit<IamMenu, 'id'>) => requestClient.put<IamMenu>(`/iam/admin/apps/${appCode}/menus/${menuId}`, data);
export const listOAuthClientsApi = (appCode: string) => requestClient.get<ListResult<IamOAuthClient>>(`/iam/admin/apps/${appCode}/clients`);
export const createOAuthClientApi = (appCode: string, data: IamOAuthClientInput) => requestClient.post<IamOAuthClient>(`/iam/admin/apps/${appCode}/clients`, data);
export const updateOAuthClientApi = (appCode: string, clientId: string, data: IamOAuthClientInput) => requestClient.put<IamOAuthClient>(`/iam/admin/apps/${appCode}/clients/${clientId}`, data);
export const listAuditEventsApi = (params: IamAuditQuery = {}) => requestClient.get<IamAuditListResult>('/iam/admin/audit/events', { params });
