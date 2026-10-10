import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemOperationLogApi {
  export interface SystemOperationLog {
    action: string;
    bizId?: string | null;
    cost: number;
    createTime: string;
    errorMessage?: string | null;
    id: string;
    ip?: string | null;
    method?: string | null;
    module: string;
    paramsText?: string | null;
    realName?: string | null;
    requestPath?: string | null;
    resultText?: string | null;
    success: number;
    updateTime: string;
    userId?: string | null;
    userName?: string | null;
    userAgent?: string | null;
  }
}

async function getOperationLogList(params: Recordable<any>) {
  return requestClient.get<{
    items: SystemOperationLogApi.SystemOperationLog[];
    total: number;
  }>('/system/operation-log/list', {
    params,
  });
}

export { getOperationLogList };
