import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

const AI_CHAT_TEST_TIMEOUT_MS = 90_000;

type AiChatStreamEvent = {
  data: unknown;
  event: string;
};

export namespace AiApi {
  export interface AiAuditLog {
    cost: null | string;
    createTime: string;
    durationMs: null | number;
    errorMessage: null | string;
    id: string;
    model: string;
    prompt: string;
    provider: string;
    rawResponse: null | string;
    taskId: string;
    tokenUsage: null | unknown;
    updateTime: string;
  }

  export interface AiResult {
    confidence: null | string;
    confirmedAt: null | string;
    confirmedBy: null | string;
    id: string;
    scene: string;
    status: string;
    structuredResult: null | unknown;
    summary: null | string;
  }

  export interface AiTask {
    auditLogs?: AiAuditLog[];
    bizId: string;
    bizType: string;
    createTime: string;
    errorMessage: null | string;
    finishedAt: null | string;
    id: string;
    inputSnapshot: null | unknown;
    result: AiResult | null;
    resultId: null | string;
    scene: string;
    status: string;
    updateTime: string;
  }

  export interface AiSceneStat {
    failedCount: number;
    requestCount: number;
    scene: string;
    successCount: number;
    totalTokens: number;
  }

  export interface AiStatsSummary {
    avgDurationMs: number;
    dailyStats: Array<{
      avgDurationMs: number;
      failedCount: number;
      label: string;
      requestCount: number;
      successCount: number;
      totalTokens: number;
    }>;
    failedCount: number;
    requestCount: number;
    sceneStats: AiSceneStat[];
    successCount: number;
    totalTokens: number;
  }

  export interface AiChatMessage {
    content: string;
    role: 'assistant' | 'system' | 'user';
  }

  export interface AiChatTestResult {
    content: string;
    model: string;
    task: AiTask;
    tokenUsage: null | unknown;
  }

  export interface AiChatStreamOptions {
    onDelta?: (content: string) => void;
    onDone?: (result: AiChatTestResult) => void;
    onError?: (message: string) => void;
  }

  export interface AiSearchHealthCheckResult {
    checkedAt: string;
    currentDate: string;
    model: string;
    rawContent: string;
    searchAvailable: boolean;
    sources: Array<{
      snippet?: null | string;
      title?: null | string;
      url: string;
    }>;
    taskId: string;
    tokenUsage: null | unknown;
    warnings: string[];
  }
}

async function getAiTaskList(params: Recordable<any>) {
  return requestClient.get<{ items: AiApi.AiTask[]; total: number }>(
    '/ai/tasks',
    { params },
  );
}

async function getAiTaskDetail(id: string) {
  return requestClient.get<AiApi.AiTask>(`/ai/tasks/${id}`);
}

async function getAiAuditLogList(params: Recordable<any>) {
  return requestClient.get<{ items: AiApi.AiAuditLog[]; total: number }>(
    '/ai/audit-logs',
    { params },
  );
}

async function getAiStatsSummary() {
  return requestClient.get<AiApi.AiStatsSummary>('/ai/stats/summary');
}

async function sendAiChatTest(data: {
  message?: string;
  messages?: AiApi.AiChatMessage[];
  model?: string;
}) {
  return requestClient.post<AiApi.AiChatTestResult>('/ai/chat-test', data, {
    timeout: AI_CHAT_TEST_TIMEOUT_MS,
  });
}

async function streamAiChatTest(
  data: {
    message?: string;
    messages?: AiApi.AiChatMessage[];
    model?: string;
  },
  options: AiApi.AiChatStreamOptions = {},
) {
  const parser = createSseParser((event) => {
    if (event.event === 'delta') {
      const content = readPayloadString(event.data, 'content');
      if (content) {
        options.onDelta?.(content);
      }
      return;
    }

    if (event.event === 'done') {
      options.onDone?.(event.data as AiApi.AiChatTestResult);
      return;
    }

    if (event.event === 'error') {
      options.onError?.(
        readPayloadString(event.data, 'message') || 'AI 流式对话请求失败',
      );
    }
  });

  await requestClient.postSSE('/ai/chat-test/stream', data, {
    onEnd: parser.flush,
    onMessage: parser.push,
  });
}

async function runAiSearchHealthCheck() {
  return requestClient.post<AiApi.AiSearchHealthCheckResult>(
    '/ai/search-health-check',
  );
}

function createSseParser(onEvent: (event: AiChatStreamEvent) => void) {
  let buffer = '';

  function parseEvent(raw: string) {
    const lines = raw.split(/\r?\n/);
    let event = 'message';
    const dataLines: string[] = [];

    lines.forEach((line) => {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    });

    const dataText = dataLines.join('\n');
    if (!dataText) {
      return;
    }

    try {
      onEvent({ data: JSON.parse(dataText) as unknown, event });
    } catch {
      onEvent({ data: dataText, event });
    }
  }

  return {
    flush() {
      if (buffer.trim()) {
        parseEvent(buffer);
      }
      buffer = '';
    },
    push(chunk: string) {
      buffer += chunk;
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? '';
      parts.forEach(parseEvent);
    },
  };
}

function readPayloadString(data: unknown, key: string): string {
  if (!data || typeof data !== 'object') {
    return '';
  }

  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

export {
  getAiAuditLogList,
  getAiStatsSummary,
  getAiTaskDetail,
  getAiTaskList,
  runAiSearchHealthCheck,
  sendAiChatTest,
  streamAiChatTest,
};
