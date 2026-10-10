import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';

import type { CurrentUser } from '../interfaces/current-user.interface';

export interface IamCompanyScope {
  dataScope: 'all' | 'assigned';
  iamCompanyId: string;
  isDefault: boolean;
  relationType: string;
  sourceCompanyId: string;
  sourceSystem: string;
}

type IamCompanyResponse = {
  dataScope?: string;
  id?: null | string;
  isDefault?: boolean;
  relationType?: string;
  sourceCompanyId?: null | string;
  sourceSystem?: null | string;
};

@Injectable()
export class IamCompanyScopeService {
  private readonly cache = new Map<string, { expiresAt: number; scopes: IamCompanyScope[] }>();

  isEnabled(): boolean {
    // IAM integration is temporarily disabled while this backend runs independently.
    return false;
  }

  async getCompanyScopes(user: CurrentUser): Promise<IamCompanyScope[]> {
    if (!this.isEnabled()) return [];
    const accessToken = user.iamAccessToken;
    if (!accessToken) {
      throw new ServiceUnavailableException('IAM company scope token is unavailable');
    }

    const cacheKey = `${process.env.IAM_APP_CODE ?? ''}:${user.id}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.scopes;

    const baseUrl = (process.env.IAM_CONTEXT_URL ?? process.env.IAM_ISSUER ?? '').replace(/\/$/u, '');
    const appCode = process.env.IAM_APP_CODE ?? '';
    if (!baseUrl || !appCode) {
      throw new ServiceUnavailableException('IAM company scope endpoint is not configured');
    }

    let response: Response;
    try {
      response = await this.fetchWithTimeout(`${baseUrl}/iam/me/apps/${encodeURIComponent(appCode)}/companies`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
    } catch {
      throw new ServiceUnavailableException('IAM company scope is unavailable');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('IAM company scope is unavailable');
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ServiceUnavailableException('IAM company scope response is invalid');
    }
    if (!Array.isArray(body)) {
      throw new ServiceUnavailableException('IAM company scope response is invalid');
    }

    const expectedSourceSystem = process.env.IAM_COMPANY_SOURCE_SYSTEM ?? process.env.DB_DATABASE ?? '';
    const scopes = body.flatMap((item): IamCompanyScope[] => {
      if (!item || typeof item !== 'object') return [];
      const company = item as IamCompanyResponse;
      const iamCompanyId = company.id?.trim();
      const sourceCompanyId = company.sourceCompanyId?.trim();
      const sourceSystem = company.sourceSystem?.trim();
      if (!iamCompanyId || !sourceCompanyId || !sourceSystem || (expectedSourceSystem && sourceSystem !== expectedSourceSystem)) return [];
      return [{
        dataScope: company.dataScope === 'all' ? 'all' : 'assigned',
        iamCompanyId,
        isDefault: Boolean(company.isDefault),
        relationType: company.relationType?.trim() || 'employee',
        sourceCompanyId,
        sourceSystem,
      }];
    });

    this.cache.set(cacheKey, {
      expiresAt: Date.now() + Number(process.env.IAM_COMPANY_SCOPE_CACHE_TTL_MS ?? 30_000),
      scopes,
    });
    return scopes;
  }

  async getScopedEnterpriseIds(user: CurrentUser): Promise<null | Set<string>> {
    const scopes = await this.getCompanyScopes(user);
    if (scopes.some((scope) => scope.dataScope === 'all')) return null;
    return new Set(scopes.map((scope) => scope.sourceCompanyId));
  }

  async setDefaultCompany(user: CurrentUser, sourceCompanyId: string): Promise<void> {
    if (!this.isEnabled()) return;
    const accessToken = user.iamAccessToken;
    if (!accessToken) {
      throw new ServiceUnavailableException('IAM company scope token is unavailable');
    }

    const target = (await this.getCompanyScopes(user)).find(
      (scope) => scope.sourceCompanyId === sourceCompanyId,
    );
    if (!target) {
      throw new ForbiddenException('Current user is not authorized for this company');
    }

    const baseUrl = (process.env.IAM_CONTEXT_URL ?? process.env.IAM_ISSUER ?? '').replace(/\/$/u, '');
    const appCode = process.env.IAM_APP_CODE ?? '';
    if (!baseUrl || !appCode) {
      throw new ServiceUnavailableException('IAM company scope endpoint is not configured');
    }

    let response: Response;
    try {
      response = await this.fetchWithTimeout(`${baseUrl}/iam/me/apps/${encodeURIComponent(appCode)}/companies/${encodeURIComponent(target.iamCompanyId)}/default`, {
        headers: { authorization: `Bearer ${accessToken}` },
        method: 'PUT',
      });
    } catch {
      throw new ServiceUnavailableException('IAM company scope is unavailable');
    }
    if (response.status === 401 || response.status === 403) {
      throw new ForbiddenException('Current user is not authorized for this company');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('IAM company scope is unavailable');
    }
    this.cache.delete(`${process.env.IAM_APP_CODE ?? ''}:${user.id}`);
  }

  getPrimedCompanyScopes(userId: number): IamCompanyScope[] {
    const cacheKey = `${process.env.IAM_APP_CODE ?? ''}:${userId}`;
    const cached = this.cache.get(cacheKey);
    if (!cached || cached.expiresAt <= Date.now()) {
      throw new ServiceUnavailableException('IAM company scope is unavailable');
    }
    return cached.scopes;
  }

  private async fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = Number(process.env.IAM_CONTEXT_TIMEOUT_MS ?? 5000);
    const timer = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
