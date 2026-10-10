import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, Observable, tap, throwError } from 'rxjs';

import { OperationLogRepository } from '../../infrastructure/database/repositories/operation-log.repository';
import { CurrentUser } from '../interfaces/current-user.interface';
import {
  OPERATION_LOG_KEY,
  OperationLogMeta,
} from '../decorators/operation-log.decorator';

type HeaderValue = string | string[] | undefined;

type RequestLike = {
  body?: unknown;
  currentUser?: CurrentUser;
  headers: Record<string, HeaderValue>;
  method?: string;
  originalUrl?: string;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  url?: string;
};

const WRITE_METHODS = new Set(['DELETE', 'PATCH', 'POST', 'PUT']);

const MODULE_LABELS: Array<[RegExp, string]> = [
  [/^\/auth(?:\/|$)/, '认证'],
  [/^\/client(?:\/|$)/, '客户端'],
  [/^\/enterprise-workspace(?:\/|$)/, '企业服务中心'],
  [/^\/enterprise(?:\/|$)/, '企业管理'],
  [/^\/policy(?:\/|$)/, '政策管理'],
  [/^\/system(?:\/|$)/, '系统管理'],
  [/^\/user(?:\/|$)/, '个人中心'],
  [/^\/upload(?:\/|$)/, '文件管理'],
  [/^\/ai(?:\/|$)/, 'AI管理'],
  [/^\/dashboard(?:\/|$)/, '数据看板'],
  [/^\/menu(?:\/|$)/, '菜单'],
];

const ACTION_KEYWORDS: Array<[RegExp, string]> = [
  [/\/batch-delete(?:\/|$)/, '批量删除'],
  [/\/reset-password(?:\/|$)/, '重置密码'],
  [/\/enable(?:\/|$)/, '启用'],
  [/\/disable(?:\/|$)/, '停用'],
  [/\/publish(?:\/|$)/, '发布'],
  [/\/archive(?:\/|$)/, '归档'],
  [/\/expire(?:\/|$)/, '标记过期'],
  [/\/incomplete(?:\/|$)/, '标记不完整'],
  [/\/run(?:\/|$)/, '执行'],
  [/\/import(?:\/|$)/, '导入'],
  [/\/save-as-new(?:\/|$)/, '另存为新数据'],
  [/\/update-existing(?:\/|$)/, '更新已有数据'],
  [/\/link-existing(?:\/|$)/, '关联已有数据'],
  [/\/ignore(?:\/|$)/, '忽略'],
  [/\/read(?:\/|$)/, '标记已读'],
  [/\/recalculate(?:\/|$)/, '重新计算'],
  [/\/confirm(?:\/|$)/, '确认'],
  [/\/reject(?:\/|$)/, '驳回'],
  [/\/refresh(?:\/|$)/, '刷新令牌'],
  [/\/logout(?:\/|$)/, '退出登录'],
  [/\/login(?:\/|$)/, '登录'],
  [/\/bind(?:\/|$)/, '绑定'],
  [/\/upload(?:\/|$)/, '上传'],
  [/\/download(?:\/|$)/, '下载'],
  [/\/export(?:\/|$)|export-/, '导出'],
  [/\/material-check(?:\/|$)/, '材料检查'],
  [/\/declarations(?:\/|$)/, '申报'],
  [/\/ai-parse-draft(?:\/|$)/, 'AI解析草稿'],
  [/\/chat-test(?:\/|$)/, 'AI对话测试'],
  [/\/search-health-check(?:\/|$)/, '搜索健康检查'],
];

@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly operationLogRepository: OperationLogRepository,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const decoratedMeta = this.reflector.getAllAndOverride<OperationLogMeta>(
      OPERATION_LOG_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<RequestLike>();
    const meta = decoratedMeta ?? this.inferMeta(request);
    if (!meta) {
      return next.handle();
    }

    const startedAt = Date.now();

    return next.handle().pipe(
      tap((result) => {
        void this.persist(meta, request, result, startedAt, true, null);
      }),
      catchError((error: unknown) => {
        void this.persist(meta, request, null, startedAt, false, error);
        return throwError(() => error);
      }),
    );
  }

  private inferMeta(request: RequestLike): OperationLogMeta | null {
    const method = (request.method ?? '').toUpperCase();
    const path = this.normalizePath(request.originalUrl ?? request.url ?? '');

    if (!this.shouldAutoLog(method, path)) {
      return null;
    }

    return {
      action: this.inferAction(method, path),
      module: this.inferModule(path),
    };
  }

  private shouldAutoLog(method: string, path: string): boolean {
    if (WRITE_METHODS.has(method)) {
      return true;
    }

    return method === 'GET' && /\/(?:download|export)|export-/.test(path);
  }

  private inferModule(path: string): string {
    const matched = MODULE_LABELS.find(([pattern]) => pattern.test(path));
    return matched?.[1] ?? '系统操作';
  }

  private inferAction(method: string, path: string): string {
    const matched = ACTION_KEYWORDS.find(([pattern]) => pattern.test(path));
    if (matched) {
      return matched[1];
    }

    if (method === 'POST') {
      return '新增或执行';
    }
    if (method === 'PUT' || method === 'PATCH') {
      return '修改';
    }
    if (method === 'DELETE') {
      return '删除';
    }
    if (method === 'GET') {
      return '查看或下载';
    }

    return '操作';
  }

  private normalizePath(path: string): string {
    const cleanPath = path.split('?')[0] || '/';
    return cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  }

  private async persist(
    meta: OperationLogMeta,
    request: RequestLike,
    result: unknown,
    startedAt: number,
    success: boolean,
    error: unknown,
  ): Promise<void> {
    const currentUser = request.currentUser ?? null;
    const unwrappedResult = this.unwrapResult(result);
    const userName = this.extractUserName(request, currentUser);

    try {
      await this.operationLogRepository.createAndSave({
        action: meta.action,
        bizId:
          this.extractBizId(request, unwrappedResult) ??
          currentUser?.id?.toString() ??
          null,
        cost: Date.now() - startedAt,
        errorMessage: success ? null : this.errorMessage(error),
        ip: this.extractIp(request),
        method: request.method ?? null,
        module: meta.module,
        paramsText: this.stringify({
          body: this.redact(request.body),
          params: this.redact(request.params),
          query: this.redact(request.query),
        }),
        realName: currentUser?.realName ?? null,
        requestPath: request.originalUrl ?? request.url ?? null,
        resultText: success ? this.stringify(unwrappedResult) : null,
        success: success ? 1 : 0,
        userAgent: this.headerText(request.headers['user-agent'], 255),
        userId: currentUser?.id?.toString() ?? null,
        userName,
      });
    } catch (saveError) {
      console.error('[OPERATION_LOG_SAVE_FAILED]', saveError);
    }
  }

  private unwrapResult(result: unknown): unknown {
    if (
      result &&
      typeof result === 'object' &&
      'code' in result &&
      'data' in result
    ) {
      return (result as { data?: unknown }).data;
    }

    return result;
  }

  private extractBizId(request: RequestLike, result: unknown): string | null {
    const enterpriseId = request.params?.enterpriseId;
    if (enterpriseId) {
      return String(enterpriseId);
    }

    const paramId = request.params?.id;
    if (paramId) {
      return String(paramId);
    }

    if (result && typeof result === 'object') {
      const payload = result as { data?: unknown; id?: unknown };
      if (payload.id !== undefined && payload.id !== null) {
        return String(payload.id);
      }
      if (payload.data && typeof payload.data === 'object') {
        const data = payload.data as { id?: unknown };
        if (data.id !== undefined && data.id !== null) {
          return String(data.id);
        }
      }
    }

    return null;
  }

  private extractIp(request: RequestLike): string | null {
    const forwarded = this.headerText(request.headers['x-forwarded-for'], 64);
    if (forwarded) {
      return forwarded.split(',')[0]?.trim() || null;
    }

    return this.headerText(request.headers['x-real-ip'], 64);
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 2) {
      return '[DepthLimit]';
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.redact(item, depth + 1));
    }

    if (value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).reduce<
        Record<string, unknown>
      >((acc, [key, item]) => {
        if (/password|token|secret/i.test(key)) {
          acc[key] = '[REDACTED]';
          return acc;
        }

        acc[key] = this.redact(item, depth + 1);
        return acc;
      }, {});
    }

    return value;
  }

  private stringify(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    try {
      return this.headerText(JSON.stringify(value), 4000);
    } catch {
      return this.headerText(String(value), 4000);
    }
  }

  private errorMessage(error: unknown): string | null {
    if (error === null || error === undefined) {
      return null;
    }

    if (error instanceof Error) {
      return this.headerText(error.message, 255);
    }

    if (typeof error === 'string') {
      return this.headerText(error, 255);
    }

    return this.headerText(this.safeJson(error), 255);
  }

  private safeJson(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private headerText(value: HeaderValue, limit: number): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const text = Array.isArray(value) ? value.join(',') : String(value);
    return text.length > limit ? text.slice(0, limit) : text;
  }

  private extractUserName(
    request: RequestLike,
    currentUser: CurrentUser | null,
  ): string | null {
    if (currentUser?.username) {
      return currentUser.username;
    }

    const body = request.body;
    if (body && typeof body === 'object') {
      const username = (body as Record<string, unknown>).username;
      if (typeof username === 'string' && username.trim()) {
        return username.trim();
      }
    }

    return null;
  }
}
