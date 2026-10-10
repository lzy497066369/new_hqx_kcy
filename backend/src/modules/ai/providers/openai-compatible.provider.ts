import { Injectable, InternalServerErrorException } from '@nestjs/common';

import type { AiChatRequest, AiChatResponse, AiChatStreamChunk, AiChatStreamResult } from '../ai.types';

class ProviderFailure extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}

interface Completion {
  choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
  model?: string;
  usage?: unknown;
  error?: unknown;
}

@Injectable()
export class OpenAiCompatibleProvider {
  private readonly baseUrl = (process.env.AI_BASE_URL || 'https://api.psydo.top/v1').replace(/\/+$/, '').replace(/^(https:\/\/api\.psydo\.top)$/, '$1/v1');
  private readonly models = [...new Set([
    process.env.AI_MODEL?.trim(),
    ...(process.env.AI_MODELS || 'gpt-6-astra,gpt-6-sol,gpt-5.6-sol').split(',').map((model) => model.trim()),
  ].filter((model): model is string => Boolean(model)))];
  private readonly timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 60_000);
  private readonly searchTimeoutMs = Number(process.env.AI_SEARCH_TIMEOUT_MS ?? 1_200_000);

  private async withFallback<T>(input: AiChatRequest, attempt: (model: string, signal: AbortSignal) => Promise<T>, hasEmitted = () => false): Promise<T> {
    if (!process.env.AI_API_KEY) throw new InternalServerErrorException('AI_API_KEY is not configured');
    const models = [...new Set([input.model, ...this.models].filter((model): model is string => Boolean(model)))];
    const timeoutMs = input.extraBody?.enable_search === true ? Math.max(this.timeoutMs, this.searchTimeoutMs) : this.timeoutMs;
    for (const [index, model] of models.entries()) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await attempt(model, controller.signal);
      } catch (error) {
        const retryable = error instanceof ProviderFailure ? error.retryable : controller.signal.aborted || error instanceof TypeError;
        if (!retryable || hasEmitted() || index === models.length - 1) {
          // Never expose upstream response bodies, credentials or uploaded document contents.
          throw new InternalServerErrorException(error instanceof ProviderFailure ? error.message : controller.signal.aborted ? 'AI provider request timed out' : 'AI provider request failed');
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new InternalServerErrorException('AI model is not configured');
  }

  private async request(input: AiChatRequest, model: string, signal: AbortSignal, stream = false) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      body: JSON.stringify({ ...this.buildRequestBody(input, model), ...(stream ? { stream: true } : {}) }),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_API_KEY}` },
      method: 'POST', signal,
    });
    if (!response.ok) {
      const body = await response.text();
      const unavailableModel = [400, 404, 422].includes(response.status) && /model_not_found|model_not_available|model_unavailable|unsupported_model|(?:model.{0,80}(?:not found|not available|unavailable|does not exist|not supported))|(?:no available channel)/i.test(body);
      throw new ProviderFailure(`AI provider request failed (HTTP ${response.status})`, [408, 429].includes(response.status) || response.status >= 500 || unavailableModel);
    }
    return response;
  }

  async chat(input: AiChatRequest): Promise<AiChatResponse> {
    return this.withFallback(input, async (model, signal) => {
      const response = await this.request(input, model, signal);
      let raw: Completion;
      try { raw = JSON.parse(await response.text()) as Completion; }
      catch { throw new ProviderFailure('AI provider response is invalid', true); }
      const content = raw?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new ProviderFailure('AI provider response is empty', true);
      return { content, model: raw.model || model, rawResponse: raw, tokenUsage: raw.usage ?? null };
    });
  }

  async stream(input: AiChatRequest, onChunk: (chunk: AiChatStreamChunk) => void | Promise<void>): Promise<AiChatStreamResult> {
    let emitted = false;
    return this.withFallback(input, async (requestedModel, signal) => {
      const response = await this.request(input, requestedModel, signal, true);
      const reader = response.body?.getReader();
      if (!reader) throw new ProviderFailure('AI provider stream is empty', true);
      const decoder = new TextDecoder();
      let buffer = '';
      let content = '';
      let model = requestedModel;
      let tokenUsage: unknown = null;
      let finished = false;
      const rawChunks: unknown[] = [];
      const consume = async (line: string) => {
        if (!line.trim().startsWith('data:')) return;
        const data = line.trim().slice(5).trim();
        if (!data) return;
        if (data === '[DONE]') { finished = true; return; }
        let raw: Completion;
        try { raw = JSON.parse(data) as Completion; }
        catch { throw new ProviderFailure('AI provider stream is invalid', true); }
        if (raw.error) throw new ProviderFailure('AI provider stream failed', true);
        rawChunks.push(raw);
        model = raw.model || model;
        tokenUsage = raw.usage ?? tokenUsage;
        const delta = raw.choices?.[0]?.delta?.content;
        if (typeof delta === 'string') content += delta;
        // Even metadata callbacks count as output; never replay a partially emitted stream.
        emitted = true;
        await onChunk({ ...(typeof delta === 'string' ? { content: delta } : {}), rawChunk: raw });
      };
      try {
        while (!finished) {
          const { done, value } = await reader.read();
          buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? '';
          for (const line of lines) { await consume(line); if (finished) break; }
          if (done) { if (buffer && !finished) await consume(buffer); break; }
        }
        if (!finished) throw new ProviderFailure('AI provider stream ended unexpectedly', true);
        if (!content.trim()) throw new ProviderFailure('AI provider stream is empty', true);
        return { content, model, rawChunks, tokenUsage };
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    }, () => emitted);
  }

  private buildRequestBody(input: AiChatRequest, model: string): Record<string, unknown> {
    const { enable_search: enableSearch, ...extraBody } = input.extraBody ?? {};
    return {
      ...(input.responseFormat === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
      ...extraBody,
      ...(enableSearch ? { tool_choice: 'auto', tools: [{ type: 'web_search' }] } : {}),
      messages: input.messages,
      model,
    };
  }
}
