import { BadGatewayException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

import { TianyanchaLogService } from './tianyancha-log.service';

type TianyanchaRequestOptions = {
  actor?: null | string;
  apiCode: string;
  apiName: string;
  companyName?: null | string;
  creditCode?: null | string;
  keyword?: null | string;
  method?: 'GET' | 'POST';
  params?: Record<string, null | string | undefined>;
  pathEnv: string;
  tycEnterpriseId?: null | string;
};

type TianyanchaResponse<T> = {
  data: T;
  logId: string;
};

@Injectable()
export class TianyanchaClientService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logService: TianyanchaLogService,
  ) {}

  async request<T = unknown>(
    options: TianyanchaRequestOptions,
  ): Promise<TianyanchaResponse<T>> {
    const baseUrl = this.getRequiredConfig('TIANYANCHA_BASE_URL');
    const token = this.getRequiredConfig('TIANYANCHA_TOKEN');
    const timeoutMs = Number(this.configService.get('TIANYANCHA_TIMEOUT_MS') ?? 8000);
    const apiPath = this.getRequiredConfig(options.pathEnv);
    const method = options.method ?? 'GET';
    const requestUrl = this.buildUrl(baseUrl, apiPath, options.params);
    const maskedHeaders = {
      Authorization: this.maskToken(token),
    };
    const startedAt = Date.now();

    try {
      const response = await fetch(requestUrl, {
        headers: {
          Authorization: token,
        },
        method,
        signal: AbortSignal.timeout(timeoutMs),
      });

      const responseText = await response.text();
      const responseJson = this.parseJsonOrNull(responseText);
      const tycCode = this.pickString(responseJson, ['error_code', 'code', 'state']);
      const tycMessage = this.pickString(responseJson, ['reason', 'message', 'msg', 'error_msg']);
      const log = await this.logService.createLog({
        apiCode: options.apiCode,
        apiName: options.apiName,
        apiUrl: requestUrl,
        companyName: options.companyName ?? null,
        createdBy: options.actor ?? null,
        creditCode: options.creditCode ?? null,
        durationMs: Date.now() - startedAt,
        httpMethod: method,
        httpStatus: response.status,
        requestHeadersMaskedJson: JSON.stringify(maskedHeaders),
        requestKeyword: options.keyword ?? null,
        requestParamsJson: JSON.stringify(options.params ?? {}),
        responseHash: responseText
          ? createHash('sha256').update(responseText).digest('hex')
          : null,
        responseJson: responseText || null,
        responseStatus: this.resolveResponseStatus(response.ok, responseJson),
        tycCode,
        tycEnterpriseId: options.tycEnterpriseId ?? null,
        tycMessage,
      });

      if (!response.ok) {
        throw new BadGatewayException(
          tycMessage || `${options.apiName} 调用失败，HTTP 状态码 ${response.status}`,
        );
      }

      if (this.isFailurePayload(responseJson)) {
        throw new BadGatewayException(tycMessage || `${options.apiName} 返回失败`);
      }

      return {
        data: (responseJson ?? responseText) as T,
        logId: String(log.id),
      };
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      await this.logService.createLog({
        apiCode: options.apiCode,
        apiName: options.apiName,
        apiUrl: requestUrl,
        companyName: options.companyName ?? null,
        createdBy: options.actor ?? null,
        creditCode: options.creditCode ?? null,
        durationMs: Date.now() - startedAt,
        errorMessage: normalizedError.message,
        httpMethod: method,
        requestHeadersMaskedJson: JSON.stringify(maskedHeaders),
        requestKeyword: options.keyword ?? null,
        requestParamsJson: JSON.stringify(options.params ?? {}),
        responseStatus: this.resolveErrorStatus(normalizedError),
        tycEnterpriseId: options.tycEnterpriseId ?? null,
      });

      if (normalizedError instanceof BadGatewayException) {
        throw normalizedError;
      }

      if (normalizedError.name === 'TimeoutError' || normalizedError.name === 'AbortError') {
        throw new BadGatewayException(`${options.apiName} 调用超时`);
      }

      throw new BadGatewayException(`${options.apiName} 调用失败`);
    }
  }

  private buildUrl(
    baseUrl: string,
    apiPath: string,
    params?: Record<string, null | string | undefined>,
  ): string {
    const url = new URL(apiPath.replace(/^\//, ''), `${baseUrl.replace(/\/+$/, '')}/`);
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });
    return url.toString();
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new InternalServerErrorException(`缺少环境变量 ${key}`);
    }
    return value;
  }

  private maskToken(token: string): string {
    if (token.length <= 10) {
      return '******';
    }
    return `${token.slice(0, 6)}******${token.slice(-4)}`;
  }

  private parseJsonOrNull(value: string): null | Record<string, any> {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as Record<string, any>;
    } catch {
      return null;
    }
  }

  private resolveResponseStatus(ok: boolean, responseJson: null | Record<string, any>): string {
    if (!ok) {
      return 'http_error';
    }
    if (!responseJson) {
      return 'success';
    }
    if (this.isFailurePayload(responseJson)) {
      return 'failed';
    }
    const result = responseJson.result ?? responseJson.data;
    if (Array.isArray(result) && result.length === 0) {
      return 'empty';
    }
    if (result && typeof result === 'object') {
      const items = (result as Record<string, unknown>).items;
      if (Array.isArray(items) && items.length === 0) {
        return 'empty';
      }
    }
    return 'success';
  }

  private resolveErrorStatus(error: Error): string {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return 'timeout';
    }
    return 'failed';
  }

  private isFailurePayload(responseJson: null | Record<string, any>): boolean {
    if (!responseJson) {
      return false;
    }

    const code = this.pickString(responseJson, ['error_code', 'code', 'state']);
    if (!code) {
      return false;
    }

    const normalized = code.trim().toLowerCase();
    return !['0', '200', 'ok', 'success'].includes(normalized);
  }

  private pickString(target: null | Record<string, any>, keys: string[]): null | string {
    if (!target) {
      return null;
    }
    for (const key of keys) {
      const value = target[key];
      if (value === undefined || value === null) {
        continue;
      }
      const normalized = String(value).trim();
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }
}
