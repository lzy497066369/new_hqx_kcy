import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { CurrentUser } from '../../common/interfaces/current-user.interface';
import { AiContextService } from './ai-context.service';
import { AiGatewayService } from './ai-gateway.service';
import { AiAuditLogService } from './ai-audit-log.service';
import { AiResultService } from './ai-result.service';
import { AiTaskService } from './ai-task.service';
import type {
  AiChatMessage,
  AiPolicyCollectOfficialSearchInput,
  AiPolicyCollectOfficialSearchResult,
  AiPolicyCollectSearchInput,
  AiPolicyCollectSearchItem,
  AiPolicyCollectSearchResult,
  AiPolicyCollectSearchSource,
  AiPolicyFileDraftParseInput,
  AiPolicyFileDraftParseResult,
  AiSearchHealthCheckResult,
} from './ai.types';
import type { CreateAiChatTestDto, CreateAiTaskDto } from './dto';
import { PolicyParseScene } from './scenes/policy-parse.scene';

@Injectable()
export class AiService {
  private searchHealthCache:
    | { checkedAt: number; result: AiSearchHealthCheckResult }
    | null = null;

  constructor(
    private readonly auditLogService: AiAuditLogService,
    private readonly contextService: AiContextService,
    private readonly gatewayService: AiGatewayService,
    private readonly policyParseScene: PolicyParseScene,
    private readonly resultService: AiResultService,
    private readonly taskService: AiTaskService,
  ) {}

  async createTask(input: CreateAiTaskDto, user?: CurrentUser): Promise<unknown> {
    const task = await this.taskService.saveTask(
      this.taskService.createTask({
        bizId: input.bizId,
        bizType: input.bizType,
        createdBy: user?.id,
        scene: input.scene,
      }),
    );

    try {
      task.status = 'running';
      await this.taskService.saveTask(task);

      const context = await this.contextService.buildContext(
        input.bizType,
        input.bizId,
      );
      task.inputSnapshot = JSON.stringify(context);
      await this.taskService.saveTask(task);

      const startAt = Date.now();
      const sceneResult = await this.runScene(input.scene, context);
      const result = await this.resultService.createResult({
        confidence: sceneResult.confidence,
        scene: input.scene,
        structuredResult: sceneResult.structuredResult,
        summary: sceneResult.summary,
        taskId: task.id,
      });

      await this.auditLogService.record({
        prompt: sceneResult.prompt,
        rawResponse: sceneResult.rawResponse,
        taskId: task.id,
        tokenUsage: sceneResult.tokenUsage,
        durationMs: Date.now() - startAt,
      });

      task.finishedAt = new Date();
      task.resultId = result.id;
      task.status = 'success';
      await this.taskService.saveTask(task);
    } catch (error) {
      task.errorMessage = error instanceof Error ? error.message : String(error);
      task.finishedAt = new Date();
      task.status = 'failed';
      await this.taskService.saveTask(task);
      throw error;
    }

    return this.taskService.toItem(task);
  }

  async chatTest(
    input: CreateAiChatTestDto,
    user?: CurrentUser,
  ): Promise<unknown> {
    this.assertSystemAdmin(user);

    const messages = this.resolveChatMessages(input);
    const task = await this.taskService.saveTask(
      this.taskService.createTask({
        bizId: `chat-${Date.now()}`,
        bizType: 'ai_chat_test',
        createdBy: user?.id,
        scene: 'chat_test',
      }),
    );
    const prompt = JSON.stringify({ messages, model: input.model ?? null });
    const startAt = Date.now();

    try {
      task.status = 'running';
      task.inputSnapshot = prompt;
      await this.taskService.saveTask(task);

      const response = await this.gatewayService.chat({
        extraBody: { enable_search: true },
        messages,
        model: input.model,
        responseFormat: 'text',
      });

      await this.auditLogService.record({
        durationMs: Date.now() - startAt,
        model: response.model,
        prompt,
        rawResponse: JSON.stringify(response.rawResponse),
        taskId: task.id,
        tokenUsage: response.tokenUsage,
      });

      const result = await this.resultService.createResult({
        confidence: null,
        scene: 'chat_test',
        structuredResult: {
          content: response.content,
          messages,
          model: response.model,
          webSearchEnabled: true,
        },
        summary: this.truncateSummary(response.content),
        taskId: task.id,
      });

      task.finishedAt = new Date();
      task.resultId = result.id;
      task.status = 'success';
      await this.taskService.saveTask(task);

      return {
        content: response.content,
        model: response.model,
        task: await this.taskService.toItem(task, true),
        tokenUsage: response.tokenUsage,
      };
    } catch (error) {
      const errorMessage = this.resolveErrorMessage(error);
      await this.safeRecordAuditLog({
        durationMs: Date.now() - startAt,
        errorMessage,
        prompt,
        taskId: task.id,
      });
      task.errorMessage = errorMessage;
      task.finishedAt = new Date();
      task.status = 'failed';
      await this.taskService.saveTask(task);
      throw new BadGatewayException(`AI 对话测试失败：${errorMessage}`);
    }
  }

  async chatTestStream(
    input: CreateAiChatTestDto,
    user: CurrentUser | undefined,
    onDelta: (content: string) => void | Promise<void>,
  ): Promise<unknown> {
    this.assertSystemAdmin(user);

    const messages = this.resolveChatMessages(input);
    const task = await this.taskService.saveTask(
      this.taskService.createTask({
        bizId: `chat-${Date.now()}`,
        bizType: 'ai_chat_test',
        createdBy: user?.id,
        scene: 'chat_test',
      }),
    );
    const prompt = JSON.stringify({
      messages,
      model: input.model ?? null,
      stream: true,
      webSearchEnabled: true,
    });
    const startAt = Date.now();

    try {
      task.status = 'running';
      task.inputSnapshot = prompt;
      await this.taskService.saveTask(task);

      const response = await this.gatewayService.stream(
        {
          extraBody: { enable_search: true },
          messages,
          model: input.model,
          responseFormat: 'text',
        },
        async (chunk) => {
          if (chunk.content) {
            await onDelta(chunk.content);
          }
        },
      );

      await this.auditLogService.record({
        durationMs: Date.now() - startAt,
        model: response.model,
        prompt,
        rawResponse: JSON.stringify(response.rawChunks),
        taskId: task.id,
        tokenUsage: response.tokenUsage,
      });

      const result = await this.resultService.createResult({
        confidence: null,
        scene: 'chat_test',
        structuredResult: {
          content: response.content,
          messages,
          model: response.model,
          stream: true,
          webSearchEnabled: true,
        },
        summary: this.truncateSummary(response.content),
        taskId: task.id,
      });

      task.finishedAt = new Date();
      task.resultId = result.id;
      task.status = 'success';
      await this.taskService.saveTask(task);

      return {
        content: response.content,
        model: response.model,
        task: await this.taskService.toItem(task, true),
        tokenUsage: response.tokenUsage,
      };
    } catch (error) {
      const errorMessage = this.resolveErrorMessage(error);
      await this.safeRecordAuditLog({
        durationMs: Date.now() - startAt,
        errorMessage,
        prompt,
        taskId: task.id,
      });
      task.errorMessage = errorMessage;
      task.finishedAt = new Date();
      task.status = 'failed';
      await this.taskService.saveTask(task);
      throw new BadGatewayException(`AI 瀵硅瘽娴嬭瘯澶辫触锛?{errorMessage}`);
    }
  }

  async runStructuredJsonCompletion(input: {
    input: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    scene: string;
    systemPrompt: string;
    taskId: string;
  }): Promise<{
    model: string;
    rawContent: string;
    structuredResult: Record<string, unknown>;
    tokenUsage: null | unknown;
  }> {
    const messages: AiChatMessage[] = [
      {
        content: input.systemPrompt,
        role: 'system',
      },
      {
        content: JSON.stringify({
          input: input.input,
          outputSchema: input.outputSchema,
          scene: input.scene,
        }),
        role: 'user',
      },
    ];
    const prompt = JSON.stringify({
      messages,
      responseFormat: 'json_object',
      scene: input.scene,
    });
    const startAt = Date.now();
    let auditModel: string | undefined;
    let auditRawResponse: null | string = null;
    let auditTokenUsage: null | unknown = null;

    try {
      const response = await this.gatewayService.chat({
        messages,
        responseFormat: 'json_object',
      });
      auditModel = response.model;
      auditRawResponse = JSON.stringify(response.rawResponse);
      auditTokenUsage = response.tokenUsage;

      const parsed = this.parseAiJsonContent(response.content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new BadGatewayException('AI 返回结构不合法');
      }

      await this.auditLogService.record({
        durationMs: Date.now() - startAt,
        model: response.model,
        prompt,
        rawResponse: auditRawResponse,
        taskId: input.taskId,
        tokenUsage: response.tokenUsage,
      });

      return {
        model: response.model,
        rawContent: response.content,
        structuredResult: parsed as Record<string, unknown>,
        tokenUsage: response.tokenUsage,
      };
    } catch (error) {
      const errorMessage = this.resolveErrorMessage(error);
      await this.safeRecordAuditLog({
        durationMs: Date.now() - startAt,
        errorMessage,
        model: auditModel,
        prompt,
        rawResponse: auditRawResponse,
        taskId: input.taskId,
        tokenUsage: auditTokenUsage,
      });
      throw new BadGatewayException(`AI JSON 生成失败：${errorMessage}`);
    }
  }

  async runVisionJsonCompletion(input: {
    imageDataUrl: string;
    outputSchema: Record<string, unknown>;
    scene: string;
    systemPrompt: string;
    taskId: string;
    userPrompt: string;
  }): Promise<{
    model: string;
    rawContent: string;
    structuredResult: Record<string, unknown>;
    tokenUsage: null | unknown;
  }> {
    const messages: AiChatMessage[] = [
      {
        content: input.systemPrompt,
        role: 'system',
      },
      {
        content: [
          { text: input.userPrompt, type: 'text' },
          {
            image_url: {
              url: input.imageDataUrl,
            },
            type: 'image_url',
          },
        ],
        role: 'user',
      },
    ];
    const prompt = JSON.stringify({
      outputSchema: input.outputSchema,
      scene: input.scene,
      userPrompt: input.userPrompt,
    });
    const startAt = Date.now();
    let auditModel: string | undefined;
    let auditRawResponse: null | string = null;
    let auditTokenUsage: null | unknown = null;

    try {
      const response = await this.gatewayService.chat({
        messages,
        model: process.env.AI_VISION_MODEL,
        responseFormat: 'json_object',
      });
      auditModel = response.model;
      auditRawResponse = JSON.stringify(response.rawResponse);
      auditTokenUsage = response.tokenUsage;

      const parsed = this.parseAiJsonContent(response.content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new BadGatewayException('AI 视觉返回结构不合法');
      }

      await this.auditLogService.record({
        durationMs: Date.now() - startAt,
        model: response.model,
        prompt,
        rawResponse: auditRawResponse,
        taskId: input.taskId,
        tokenUsage: response.tokenUsage,
      });

      return {
        model: response.model,
        rawContent: response.content,
        structuredResult: parsed as Record<string, unknown>,
        tokenUsage: response.tokenUsage,
      };
    } catch (error) {
      const errorMessage = this.resolveErrorMessage(error);
      await this.safeRecordAuditLog({
        durationMs: Date.now() - startAt,
        errorMessage,
        model: auditModel,
        prompt,
        rawResponse: auditRawResponse,
        taskId: input.taskId,
        tokenUsage: auditTokenUsage,
      });
      throw new BadGatewayException(`AI 视觉 JSON 解析失败：${errorMessage}`);
    }
  }

  async searchHealthCheck(
    user?: CurrentUser,
    options: { assertAdmin?: boolean; force?: boolean } = {},
  ): Promise<AiSearchHealthCheckResult> {
    if (options.assertAdmin !== false) {
      this.assertSystemAdmin(user);
    }

    const cacheTtlMs = Math.max(
      60_000,
      Number(process.env.AI_SEARCH_HEALTH_CACHE_SECONDS ?? 600) * 1000,
    );
    if (
      !options.force &&
      this.searchHealthCache &&
      Date.now() - this.searchHealthCache.checkedAt < cacheTtlMs
    ) {
      return this.searchHealthCache.result;
    }

    const systemDate = this.formatDateOnly(new Date());
    const messages = this.buildSearchHealthCheckMessages(systemDate);
    const task = await this.taskService.saveTask(
      this.taskService.createTask({
        bizId: `search-health-${Date.now()}`,
        bizType: 'ai_search_health_check',
        createdBy: user?.id,
        scene: 'search_health_check',
      }),
    );
    const prompt = JSON.stringify({
      messages,
      responseFormat: 'json_object',
      systemDate,
    });
    const startAt = Date.now();
    let auditModel: string | undefined;
    let auditRawResponse: null | string = null;
    let auditTokenUsage: null | unknown = null;

    try {
      task.status = 'running';
      task.inputSnapshot = prompt;
      await this.taskService.saveTask(task);

      const response = await this.gatewayService.chat({
        extraBody: { enable_search: true },
        messages,
        responseFormat: 'json_object',
      });
      auditModel = response.model;
      auditRawResponse = JSON.stringify(response.rawResponse);
      auditTokenUsage = response.tokenUsage;

      const parsed = this.parseAiJsonContent(response.content);
      const resultPayload = this.normalizeSearchHealthCheckResult(
        parsed,
        response.content,
        response.model,
        systemDate,
        String(task.id),
        response.tokenUsage,
      );

      await this.auditLogService.record({
        durationMs: Date.now() - startAt,
        model: auditModel,
        prompt,
        rawResponse: auditRawResponse,
        taskId: task.id,
        tokenUsage: auditTokenUsage,
      });

      const result = await this.resultService.createResult({
        confidence: resultPayload.searchAvailable ? 'high' : 'low',
        scene: 'search_health_check',
        structuredResult: resultPayload,
        summary: resultPayload.searchAvailable
          ? `AI 联网搜索自检通过，来源 ${resultPayload.sources.length} 个`
          : `AI 联网搜索自检未通过：${resultPayload.warnings.join('；')}`,
        taskId: task.id,
      });

      task.finishedAt = new Date();
      task.resultId = result.id;
      task.status = resultPayload.searchAvailable ? 'success' : 'failed';
      task.errorMessage = resultPayload.searchAvailable
        ? null
        : resultPayload.warnings.join('；');
      await this.taskService.saveTask(task);

      this.searchHealthCache = {
        checkedAt: Date.now(),
        result: resultPayload,
      };

      return resultPayload;
    } catch (error) {
      const errorMessage = this.resolveErrorMessage(error);
      await this.safeRecordAuditLog({
        durationMs: Date.now() - startAt,
        errorMessage,
        model: auditModel,
        prompt,
        rawResponse: auditRawResponse,
        taskId: task.id,
        tokenUsage: auditTokenUsage,
      });
      task.errorMessage = errorMessage;
      task.finishedAt = new Date();
      task.status = 'failed';
      await this.taskService.saveTask(task);
      throw new BadGatewayException(`AI 联网搜索自检失败：${errorMessage}`);
    }
  }

  async parsePolicyFileDraft(
    input: AiPolicyFileDraftParseInput,
    user?: CurrentUser,
  ): Promise<AiPolicyFileDraftParseResult> {
    const safeInput = input ?? {};
    const fetchedContent = await this.fetchPolicyFileUrlContent(
      safeInput.officialFileUrl,
    );
    const parseInput = {
      ...safeInput,
      content: [fetchedContent?.content, safeInput.content]
        .filter((item): item is string => Boolean(item?.trim()))
        .join('\n\n'),
    };
    const messages = this.buildPolicyFileDraftParseMessages(parseInput);
    const task = await this.taskService.saveTask(
      this.taskService.createTask({
        bizId: `policy-file-draft-${Date.now()}`,
        bizType: 'policy_file_draft',
        createdBy: user?.id,
        scene: 'policy_file_draft_parse',
      }),
    );
    const prompt = JSON.stringify({
      fetchedUrl: fetchedContent?.url ?? null,
      input: parseInput,
      messages,
      responseFormat: 'json_object',
    });
    const startAt = Date.now();
    let auditModel: string | undefined;
    let auditRawResponse: null | string = null;
    let auditTokenUsage: null | unknown = null;

    try {
      task.status = 'running';
      task.inputSnapshot = prompt;
      await this.taskService.saveTask(task);

      const response = await this.gatewayService.chat({
        messages,
        responseFormat: 'json_object',
      });
      auditModel = response.model;
      auditRawResponse = JSON.stringify(response.rawResponse);
      auditTokenUsage = response.tokenUsage;

      const parsed = this.parseAiJsonContent(response.content);
      const structuredResult = this.normalizePolicyFileDraftParseResult(parsed);
      const summary = structuredResult.summary ?? null;

      await this.auditLogService.record({
        durationMs: Date.now() - startAt,
        model: auditModel,
        prompt,
        rawResponse: auditRawResponse,
        taskId: task.id,
        tokenUsage: auditTokenUsage,
      });

      const result = await this.resultService.createResult({
        confidence: this.normalizeConfidenceLabel(
          parsed && typeof parsed === 'object'
            ? (parsed as Record<string, unknown>).confidence
            : null,
        ),
        scene: 'policy_file_draft_parse',
        structuredResult,
        summary,
        taskId: task.id,
      });

      task.finishedAt = new Date();
      task.resultId = result.id;
      task.status = 'success';
      await this.taskService.saveTask(task);

      return {
        confidence: result.confidence,
        fetchedContent: fetchedContent?.content ?? null,
        fetchedUrl: fetchedContent?.url ?? null,
        model: response.model,
        rawContent: response.content,
        structuredResult,
        summary,
        taskId: String(task.id),
        tokenUsage: response.tokenUsage,
      };
    } catch (error) {
      const errorMessage = this.resolveErrorMessage(error);
      await this.safeRecordAuditLog({
        durationMs: Date.now() - startAt,
        errorMessage,
        model: auditModel,
        prompt,
        rawResponse: auditRawResponse,
        taskId: task.id,
        tokenUsage: auditTokenUsage,
      });
      task.errorMessage = errorMessage;
      task.finishedAt = new Date();
      task.status = 'failed';
      await this.taskService.saveTask(task);
      throw new BadGatewayException(`AI 政策文件草稿解析失败：${errorMessage}`);
    }
  }

  async runPolicyCollectSearch(
    input: AiPolicyCollectSearchInput,
    user?: CurrentUser,
  ): Promise<AiPolicyCollectSearchResult> {
    const messages = this.buildPolicyCollectSearchMessages(input);
    const task = await this.taskService.saveTask(
      this.taskService.createTask({
        bizId: input.bizId,
        bizType: 'policy_collect_run',
        createdBy: user?.id,
        scene: 'policy_collect_search',
      }),
    );
    const prompt = JSON.stringify({
      input,
      messages,
      responseFormat: 'json_object',
    });
    const startAt = Date.now();
    let auditModel: string | undefined;
    let auditRawResponse: null | string = null;
    let auditTokenUsage: null | unknown = null;

    try {
      task.status = 'running';
      task.inputSnapshot = prompt;
      await this.taskService.saveTask(task);

      const response = await this.gatewayService.chat({
        extraBody: this.buildPolicyCollectSearchExtraBody(input),
        messages,
        responseFormat: 'json_object',
      });
      auditModel = response.model;
      auditRawResponse = JSON.stringify(response.rawResponse);
      auditTokenUsage = response.tokenUsage;
      const parsed = this.parseAiJsonContent(response.content);
      const items = this.normalizePolicyCollectSearchItems(parsed, input);

      await this.auditLogService.record({
        durationMs: Date.now() - startAt,
        model: auditModel,
        prompt,
        rawResponse: auditRawResponse,
        taskId: task.id,
        tokenUsage: auditTokenUsage,
      });

      const result = await this.resultService.createResult({
        confidence: null,
        scene: 'policy_collect_search',
        structuredResult: parsed,
        summary: `采集到 ${items.length} 条候选政策`,
        taskId: task.id,
      });

      task.finishedAt = new Date();
      task.resultId = result.id;
      task.status = 'success';
      await this.taskService.saveTask(task);

      return {
        items,
        model: response.model,
        rawContent: response.content,
        taskId: String(task.id),
        tokenUsage: response.tokenUsage,
      };
    } catch (error) {
      const errorMessage = this.resolveErrorMessage(error);
      await this.safeRecordAuditLog({
        durationMs: Date.now() - startAt,
        errorMessage,
        model: auditModel,
        prompt,
        rawResponse: auditRawResponse,
        taskId: task.id,
        tokenUsage: auditTokenUsage,
      });
      task.errorMessage = errorMessage;
      task.finishedAt = new Date();
      task.status = 'failed';
      await this.taskService.saveTask(task);
      throw new BadGatewayException(`AI 政策采集失败：${errorMessage}`);
    }
  }

  async runPolicyCollectOfficialSearch(
    input: AiPolicyCollectOfficialSearchInput,
    user?: CurrentUser,
  ): Promise<AiPolicyCollectOfficialSearchResult> {
    const messages = this.buildPolicyCollectOfficialSearchMessages(input);
    const task = await this.taskService.saveTask(
      this.taskService.createTask({
        bizId: input.bizId,
        bizType: 'policy_collect_run',
        createdBy: user?.id,
        scene: 'policy_collect_official_search',
      }),
    );
    const prompt = JSON.stringify({
      input,
      messages,
      responseFormat: 'json_object',
    });
    const startAt = Date.now();
    let auditModel: string | undefined;
    let auditRawResponse: null | string = null;
    let auditTokenUsage: null | unknown = null;

    try {
      task.status = 'running';
      task.inputSnapshot = prompt;
      await this.taskService.saveTask(task);

      const response = await this.gatewayService.chat({
        extraBody: this.buildPolicyCollectSearchExtraBody(),
        messages,
        responseFormat: 'json_object',
      });
      auditModel = response.model;
      auditRawResponse = JSON.stringify(response.rawResponse);
      auditTokenUsage = response.tokenUsage;
      const parsed = this.parseAiJsonContent(response.content);
      const results = this.normalizePolicyCollectSearchSources(parsed, input);
      const warnings = this.normalizeStringArray(
        parsed && typeof parsed === 'object'
          ? (parsed as { warnings?: unknown }).warnings
          : null,
      );

      await this.auditLogService.record({
        durationMs: Date.now() - startAt,
        model: auditModel,
        prompt,
        rawResponse: auditRawResponse,
        taskId: task.id,
        tokenUsage: auditTokenUsage,
      });

      const result = await this.resultService.createResult({
        confidence: null,
        scene: 'policy_collect_official_search',
        structuredResult: parsed,
        summary: `搜索到 ${results.length} 条候选官方来源`,
        taskId: task.id,
      });

      task.finishedAt = new Date();
      task.resultId = result.id;
      task.status = 'success';
      await this.taskService.saveTask(task);

      return {
        model: response.model,
        rawContent: response.content,
        results,
        taskId: String(task.id),
        tokenUsage: response.tokenUsage,
        warnings,
      };
    } catch (error) {
      const errorMessage = this.resolveErrorMessage(error);
      await this.safeRecordAuditLog({
        durationMs: Date.now() - startAt,
        errorMessage,
        model: auditModel,
        prompt,
        rawResponse: auditRawResponse,
        taskId: task.id,
        tokenUsage: auditTokenUsage,
      });
      task.errorMessage = errorMessage;
      task.finishedAt = new Date();
      task.status = 'failed';
      await this.taskService.saveTask(task);
      throw new BadGatewayException(`AI 政策官方搜索失败：${errorMessage}`);
    }
  }

  async getTask(id: string): Promise<unknown> {
    return this.taskService.toItem(await this.taskService.getTaskOrThrow(id), true);
  }

  async listTasks(
    query: Record<string, string | string[] | undefined>,
    user?: CurrentUser,
  ): Promise<unknown> {
    this.assertSystemAdmin(user);
    return this.taskService.list(query);
  }

  async listAuditLogs(
    query: Record<string, string | string[] | undefined>,
    user?: CurrentUser,
  ): Promise<unknown> {
    this.assertSystemAdmin(user);
    return this.auditLogService.list(query);
  }

  async getStatsSummary(user?: CurrentUser): Promise<unknown> {
    this.assertSystemAdmin(user);
    return this.taskService.getStatsSummary();
  }

  async confirmResult(id: string, user?: CurrentUser): Promise<unknown> {
    const result = await this.resultService.updateStatus(id, 'confirmed', user?.id);
    return {
      id: String(result.id),
      status: result.status,
    };
  }

  async rejectResult(id: string, user?: CurrentUser): Promise<unknown> {
    const result = await this.resultService.updateStatus(id, 'rejected', user?.id);
    return {
      id: String(result.id),
      status: result.status,
    };
  }

  private async runScene(scene: string, context: Parameters<PolicyParseScene['run']>[0]) {
    if (scene === 'policy_parse') {
      return this.policyParseScene.run(context);
    }

    throw new BadRequestException(`Unsupported AI scene: ${scene}`);
  }

  private assertSystemAdmin(user?: CurrentUser): void {
    if (!user?.roles?.includes('admin')) {
      throw new ForbiddenException('Only system administrators can access AI records');
    }
  }

  private resolveChatMessages(input: CreateAiChatTestDto): AiChatMessage[] {
    if (input.messages?.length) {
      return input.messages.map((message) => ({
        content: message.content,
        role: message.role,
      }));
    }

    const message = input.message?.trim();
    if (!message) {
      throw new BadRequestException('message or messages is required');
    }

    return [{ content: message, role: 'user' }];
  }

  private buildPolicyCollectSearchMessages(
    input: AiPolicyCollectSearchInput,
  ): AiChatMessage[] {
    const officialRules = input.officialDomainRules?.trim()
      ? input.officialDomainRules.trim()
      : '优先政府官网、主管部门官网、官方公告平台、官方政务服务平台；不要采用公众号、自媒体、转载站、新闻二次报道作为正式来源。';
    const department = input.departmentName?.trim() || '未指定';

    const searchResults = input.searchResults?.length
      ? JSON.stringify(input.searchResults.slice(0, 30), null, 2)
      : null;

    return [
      {
        content:
          '你是政策文件采集解析助手。当前日期必须以后端传入的“系统当前日期”为准，不得使用模型知识库或搜索摘要里的旧当前年份。优先返回官方正式政策文件，也可以返回高度相关但日期或官方性需要人工核验的候选；不要返回明显无关的解读稿、新闻稿、转载页或非官方页面。没有后端候选来源时，本请求已开启小米 MiMo web_search 联网搜索工具，必须基于搜索工具返回的可核验来源解析，不得凭记忆生成政策。必须输出 JSON，不要输出 Markdown。',
        role: 'system',
      },
      {
        content: [
          `采集任务：${input.jobName}`,
          `统一政策项目：${input.projectName}`,
          `政策文件分类：${input.policyCategoryName}（${input.policyCategory}）`,
          `系统当前日期：${input.systemDate}`,
          `采集发布日期范围：${input.publishDateStart} 至 ${input.publishDateEnd}`,
          `日期判断规则：${input.publishDateStart} 至 ${input.publishDateEnd} 是系统当前日期 ${input.systemDate} 的前一自然年范围，不是未来时间；不得输出“截至当前时间（2024年）”这类与系统当前日期冲突的判断。`,
          `区域范围：${this.formatPolicyCollectRegionScope(input.regionScope)}`,
          `区域：${input.regionName}`,
          `主管部门：${department}`,
          `关键词：${input.keywords.join('、')}`,
          `官方来源规则：${officialRules}`,
          input.searchTaskId ? `官方搜索任务ID：${input.searchTaskId}` : '',
          '',
          searchResults
            ? '下面是后端已通过 AI 搜索能力取得的候选来源。你只能基于这些候选来源解析政策文件，不得编造 URL，不得把候选来源之外的网页写入结果。'
            : '本请求已开启小米 MiMo web_search 联网搜索工具。请实际使用联网搜索能力查找与该项目和区域匹配的官方政策、公告、通知或公示候选；不要仅凭模型记忆回答。没有找到可核验来源时返回 {"items":[]}。',
          searchResults ? `候选官方来源：\n${searchResults}` : '',
          '',
          this.buildPolicyCategoryParseInstruction(input.policyCategory),
          '',
          '优先用发布日期、公示日期或申报通知日期判断是否落在采集发布日期范围内；只有能明确判断早于或晚于该范围的候选才剔除。',
          '日期无法判断、没有日期依据但标题/摘要/来源高度相关的候选可以返回，publishDate 填空，officialConfidence 设为 low 或 medium，并在 aiReason 写明“日期待核验”，进入待审查由人工确认。',
          '如果候选来源明显不是政策文件、没有可信来源、只是新闻解读/转载/汇总页，请剔除。没有找到相关候选时返回 {"items":[]}。',
          '返回 JSON 格式：',
          '{"items":[{"title":"政策标题","officialUrl":"官方原文URL","issuingAgency":"发文机关","documentNo":"文号或空","publishDate":"YYYY-MM-DD或空","summary":"摘要","rawText":"原文关键内容或可获取正文","officialVerified":true,"officialConfidence":"high|medium|low","aiReason":"为什么认为是官方正式文件","structuredResult":{"conditions":[],"materials":[],"targetObjects":[],"subsidy":"","startDate":null,"endDate":null}}]}',
        ]
          .filter(Boolean)
          .join('\n'),
        role: 'user',
      },
    ];
  }

  private buildPolicyCollectOfficialSearchMessages(
    input: AiPolicyCollectOfficialSearchInput,
  ): AiChatMessage[] {
    const officialRules = input.officialDomainRules?.trim()
      ? input.officialDomainRules.trim()
      : '优先政府官网、主管部门官网、官方公告平台、官方政务服务平台；不要采用公众号、自媒体、转载站、新闻二次报道作为正式来源。';

    return [
      {
        content:
          '你是政策文件官方来源搜索助手。当前日期必须以后端传入的“系统当前日期”为准，不得使用模型知识库或搜索摘要里的旧当前年份。本请求已开启小米 MiMo web_search 联网搜索工具，必须实际调用搜索能力核验结果；不要凭记忆编造网页、标题或 URL。必须输出 JSON，不要输出 Markdown。',
        role: 'system',
      },
      {
        content: [
          `采集任务：${input.jobName}`,
          `统一政策项目：${input.projectName}`,
          `政策文件分类：${input.policyCategoryName}（${input.policyCategory}）`,
          `系统当前日期：${input.systemDate}`,
          `采集发布日期范围：${input.publishDateStart} 至 ${input.publishDateEnd}`,
          `日期判断规则：${input.publishDateStart} 至 ${input.publishDateEnd} 是系统当前日期 ${input.systemDate} 的前一自然年范围，不是未来时间；不得输出“截至当前时间（2024年）”这类与系统当前日期冲突的判断。`,
          `区域范围：${this.formatPolicyCollectRegionScope(input.regionScope)}`,
          `区域：${input.regionName}`,
          `关键词：${input.keywords.join('、')}`,
          `官方来源规则：${officialRules}`,
          '',
          this.buildPolicyCategorySearchInstruction(input.policyCategory),
          '',
          '请分别执行以下搜索词，查找官方政策、公告、通知、公示或原文页面候选：',
          ...input.queries.map((query, index) => `${index + 1}. ${query}`),
          '',
          '每条 results 都必须来自联网搜索返回的可访问 http/https URL；如果搜索结果没有给出明确来源、annotations 或可核验 URL，不要把它写入 results。',
          '优先返回带有明确 URL 且发布日期/公示日期/申报通知日期处于采集发布日期范围内的候选结果；只有能明确判断日期超出范围的结果才剔除。',
          '搜索摘要无法判断日期但 URL 属于官方来源或标题/摘要高度相关时可以返回，publishDate 填空，并在 officialReason 标明“日期待解析核验”；后续会进入待审查由人工确认。',
          '优先 .gov.cn、各级政府官网、科技/财政/税务等主管部门官网；公示情况可使用 innocom.gov.cn；排除公众号、自媒体、新闻二次报道、转载站、聚合站。',
          '如果联网/搜索能力不可用，或没有找到相关候选，请返回 {"results":[],"warnings":["说明原因"]}。',
          '返回 JSON 格式：',
          '{"results":[{"query":"命中的搜索词","title":"网页标题","url":"官方URL","snippet":"搜索摘要或页面关键内容","source":"来源站点或部门","publishDate":"YYYY-MM-DD或空","officialLikely":true,"officialReason":"为什么像官方正式来源"}],"warnings":[]}',
        ].join('\n'),
        role: 'user',
      },
    ];
  }

  private buildSearchHealthCheckMessages(systemDate: string): AiChatMessage[] {
    return [
      {
        content:
          '你是 AI 联网搜索能力自检助手。必须使用可用的联网/搜索能力查找公开网页来源，不要凭模型记忆回答。必须输出 JSON，不要输出 Markdown。',
        role: 'system',
      },
      {
        content: [
          `系统当前日期：${systemDate}`,
          '请联网搜索 2025 年中国政府网站上发布的政策、通知或公示类公开网页，用于验证搜索能力是否可用。',
          '要求：返回至少 1 个带 http 或 https URL 的公开来源；如果无法联网搜索、无法获取来源、只能凭记忆回答，searchAvailable 必须为 false，并在 warnings 说明原因。',
          '返回 JSON 格式：',
          '{"searchAvailable":true,"currentDate":"YYYY-MM-DD","sources":[{"title":"网页标题","url":"https://...","snippet":"简短摘要"}],"warnings":[]}',
        ].join('\n'),
        role: 'user',
      },
    ];
  }

  private buildPolicyFileDraftParseMessages(
    input: AiPolicyFileDraftParseInput,
  ): AiChatMessage[] {
    return [
      {
        content:
          '你是中国企业政策文件识别解析助手。只根据用户提供的标题、正文、附件链接和官方链接解析，不要联网搜索，不要编造来源。必须输出 JSON，不要输出 Markdown。',
        role: 'system',
      },
      {
        content: [
          `政策标题：${input.title ?? ''}`,
          `政策分类：${input.policyCategory ?? ''}`,
          `区域：${input.regionName ?? ''}`,
          `统一政策项目：${input.projectName ?? ''}`,
          `正式文件地址：${input.officialFileUrl ?? ''}`,
          `附件地址：${input.fileUrl ?? ''}`,
          '',
          '政策正文或人工录入内容：',
          input.content ?? '',
          '',
          '请解析并返回 JSON：',
          '{"summary":"摘要","policyName":"政策名称","targetObjects":["适用对象"],"conditions":["申报条件"],"materials":["材料要求"],"startDate":"YYYY-MM-DD或null","endDate":"YYYY-MM-DD或null","subsidy":"奖补说明","applicationLevel":"申报级别或null","department":"主管部门或null","confidence":"low|medium|high"}',
          '字段缺失时使用 null、空字符串或空数组，不要猜测。',
        ].join('\n'),
        role: 'user',
      },
    ];
  }

  private async fetchPolicyFileUrlContent(
    value?: null | string,
  ): Promise<null | { content: string; url: string }> {
    const url = value?.trim();
    if (!url) {
      return null;
    }
    if (!/^https?:\/\//i.test(url)) {
      throw new BadRequestException('正式文件地址必须是 http 或 https 链接');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new BadRequestException('正式文件地址格式不正确');
    }
    if (
      parsedUrl.hostname === 'localhost' ||
      parsedUrl.hostname === '127.0.0.1' ||
      parsedUrl.hostname === '0.0.0.0' ||
      parsedUrl.hostname === '::1'
    ) {
      throw new BadRequestException('正式文件地址不允许访问本机地址');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/html,text/plain,application/xhtml+xml,*/*;q=0.8',
          'User-Agent': 'new-kjqb-policy-parser/1.0',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new BadRequestException(
          `正式文件地址读取失败：HTTP ${response.status}`,
        );
      }

      const rawText = (await response.text()).slice(0, 300_000);
      const content = this.extractReadableText(rawText).slice(0, 20_000);
      if (!content) {
        throw new BadRequestException('正式文件地址未读取到可解析文本内容');
      }
      return { content, url };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`正式文件地址读取失败：${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractReadableText(value: string): string {
    return value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildPolicyCollectSearchExtraBody(
    input?: AiPolicyCollectSearchInput,
  ): Record<string, unknown> {
    if (input?.searchResults?.length) {
      return {};
    }
    if (process.env.AI_POLICY_COLLECT_ENABLE_SEARCH === '0') {
      return {};
    }
    return { enable_search: true };
  }

  private normalizeSearchHealthCheckResult(
    parsed: unknown,
    rawContent: string,
    model: string,
    systemDate: string,
    taskId: string,
    tokenUsage: null | unknown,
  ): AiSearchHealthCheckResult {
    const objectValue =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    const sources = Array.isArray(objectValue.sources)
      ? objectValue.sources
          .filter(
            (item): item is Record<string, unknown> =>
              !!item && typeof item === 'object' && !Array.isArray(item),
          )
          .map((item) => ({
            snippet: this.readOptionalString(item.snippet),
            title: this.readOptionalString(item.title),
            url: this.normalizeUrl(this.readOptionalString(item.url) ?? ''),
          }))
          .filter((item) => /^https?:\/\//i.test(item.url))
          .slice(0, 5)
      : [];
    const warnings = this.normalizeStringArray(objectValue.warnings);
    const unavailableWarning = warnings.some((item) =>
      /无法联网|不能联网|搜索不可用|无法搜索|no search|unavailable|not available/i.test(
        item,
      ),
    );
    const rawSaysUnavailable =
      /无法联网|不能联网|搜索不可用|无法搜索|no search|unavailable|not available/i.test(
        rawContent,
      );
    const searchAvailable =
      objectValue.searchAvailable === true &&
      sources.length > 0 &&
      !unavailableWarning &&
      !rawSaysUnavailable;
    const normalizedWarnings = [...warnings];

    if (sources.length === 0) {
      normalizedWarnings.push('AI 自检未返回可核验的 http(s) 来源 URL');
    }
    if (objectValue.searchAvailable !== true) {
      normalizedWarnings.push('AI 自检未声明联网搜索可用');
    }
    if (unavailableWarning || rawSaysUnavailable) {
      normalizedWarnings.push('AI 自检响应包含联网搜索不可用提示');
    }

    return {
      checkedAt: new Date().toISOString(),
      currentDate: this.readOptionalString(objectValue.currentDate) ?? systemDate,
      model,
      rawContent,
      searchAvailable,
      sources,
      taskId,
      tokenUsage,
      warnings: [...new Set(normalizedWarnings)],
    };
  }

  private normalizePolicyFileDraftParseResult(
    parsed: unknown,
  ): AiPolicyFileDraftParseResult['structuredResult'] {
    const objectValue =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};

    return {
      applicationLevel: this.readOptionalString(objectValue.applicationLevel),
      conditions: this.normalizeStringArray(objectValue.conditions),
      department: this.readOptionalString(objectValue.department),
      endDate: this.readOptionalString(objectValue.endDate),
      materials: this.normalizeStringArray(objectValue.materials),
      policyName: this.readOptionalString(objectValue.policyName),
      startDate: this.readOptionalString(objectValue.startDate),
      subsidy: this.readOptionalString(objectValue.subsidy),
      summary: this.readOptionalString(objectValue.summary),
      targetObjects: this.normalizeStringArray(objectValue.targetObjects),
    };
  }

  private buildPolicyCategorySearchInstruction(policyCategory: string): string {
    if (policyCategory === 'reward') {
      return '分类搜索要求：只搜索奖补、补贴、奖励、扶持资金、兑现、资助标准等正式政策文件。';
    }
    if (policyCategory === 'publicity') {
      return '分类搜索要求：只搜索公示、名单、拟认定、通过名单、备案名单等正式公示文件；可重点搜索 http://www.innocom.gov.cn/。';
    }
    if (policyCategory === 'notice') {
      return '分类搜索要求：只搜索申报通知、组织申报、申报指南、申报时间、材料要求等正式通知文件。';
    }
    return '分类搜索要求：搜索其他官方正式政策文件，不要强行归入奖补、公示或申报通知。';
  }

  private buildPolicyCategoryParseInstruction(policyCategory: string): string {
    if (policyCategory === 'reward') {
      return '分类解析要求：重点提取补贴金额、奖补条件、适用对象、兑现方式、申报或兑现时间。';
    }
    if (policyCategory === 'publicity') {
      return '分类解析要求：重点提取公示批次、公示名单、企业名称、异议期、认定年度；非名单或非公示文件不要返回。';
    }
    if (policyCategory === 'notice') {
      return '分类解析要求：重点提取申报时间、申报条件、材料要求、主管部门、申报流程。';
    }
    return '分类解析要求：按官方正式政策文件解析摘要、适用对象、条件、材料、时间等通用信息。';
  }

  private formatPolicyCollectRegionScope(regionScope: string): string {
    const labels: Record<string, string> = {
      all: '全部',
      city: '市',
      district: '区县',
      province: '省',
    };
    return labels[regionScope] ?? regionScope;
  }

  private parseAiJsonContent(content: string): unknown {
    try {
      return JSON.parse(content) as unknown;
    } catch {
      const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenced?.[1]) {
        try {
          return JSON.parse(fenced[1]) as unknown;
        } catch {
          // Continue to object-slice fallback below.
        }
      }

      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(content.slice(start, end + 1)) as unknown;
        } catch {
          // Fall through to the final error.
        }
      }
    }

    throw new BadGatewayException('AI 返回不是有效 JSON');
  }

  private normalizePolicyCollectSearchItems(
    parsed: unknown,
    input: AiPolicyCollectSearchInput,
  ): AiPolicyCollectSearchItem[] {
    if (!parsed || typeof parsed !== 'object') {
      throw new BadGatewayException('AI 返回结构不合法');
    }
    const items = (parsed as { items?: unknown }).items;
    if (!Array.isArray(items)) {
      throw new BadGatewayException('AI 返回缺少 items 数组');
    }

    return items
      .filter((item): item is Record<string, unknown> => {
        return !!item && typeof item === 'object' && !Array.isArray(item);
      })
      .slice(0, 20)
      .map((item) => ({
        aiReason: this.readOptionalString(item.aiReason),
        documentNo: this.readOptionalString(item.documentNo),
        issuingAgency: this.readOptionalString(item.issuingAgency),
        officialConfidence: this.normalizeConfidenceLabel(item.officialConfidence),
        officialUrl: this.readOptionalString(item.officialUrl),
        officialVerified: this.readOptionalBooleanLike(item.officialVerified),
        publishDate: this.readOptionalString(item.publishDate),
        rawText: this.readOptionalString(item.rawText),
        structuredResult:
          item.structuredResult &&
          typeof item.structuredResult === 'object' &&
          !Array.isArray(item.structuredResult)
            ? (item.structuredResult as Record<string, unknown>)
            : null,
        summary: this.readOptionalString(item.summary),
        title: this.readOptionalString(item.title),
      }))
      .filter((item) => this.shouldKeepPolicyCollectDate(item.publishDate, input));
  }

  private normalizePolicyCollectSearchSources(
    parsed: unknown,
    input: AiPolicyCollectOfficialSearchInput,
  ): AiPolicyCollectSearchSource[] {
    if (!parsed || typeof parsed !== 'object') {
      throw new BadGatewayException('AI 搜索返回结构不合法');
    }
    const results = (parsed as { results?: unknown }).results;
    if (!Array.isArray(results)) {
      throw new BadGatewayException('AI 搜索返回缺少 results 数组');
    }

    return results
      .filter((item): item is Record<string, unknown> => {
        return !!item && typeof item === 'object' && !Array.isArray(item);
      })
      .slice(0, 50)
      .map((item) => ({
        officialLikely: this.readOptionalBoolean(item.officialLikely),
        officialReason: this.readOptionalString(item.officialReason),
        publishDate: this.readOptionalString(item.publishDate),
        query: this.readOptionalString(item.query),
        snippet: this.readOptionalString(item.snippet) ?? '',
        source: this.readOptionalString(item.source),
        title: this.readOptionalString(item.title) ?? '',
        url: this.normalizeUrl(this.readOptionalString(item.url) ?? ''),
      }))
      .filter(
        (item) =>
          item.title &&
          item.url &&
          this.shouldKeepPolicyCollectDate(item.publishDate, input),
      );
  }

  private shouldKeepPolicyCollectDate(
    value: null | string | undefined,
    input: { publishDateEnd: string; publishDateStart: string },
  ): boolean {
    if (!value) {
      return true;
    }
    const date = this.parsePolicyCollectDate(value);
    const start = this.parsePolicyCollectDate(input.publishDateStart);
    const end = this.parsePolicyCollectDate(input.publishDateEnd);
    if (!date || !start || !end) {
      return true;
    }
    return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
  }

  private parsePolicyCollectDate(value: string): Date | null {
    const match = value.match(/\b(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})/);
    if (!match) {
      return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => this.readOptionalString(item))
      .filter((item): item is string => Boolean(item));
  }

  private readOptionalString(value: unknown): null | string {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed || null;
  }

  private normalizeConfidenceLabel(value: unknown): null | string {
    const confidence = this.readOptionalString(value)?.toLowerCase();
    return confidence === 'high' || confidence === 'medium' || confidence === 'low'
      ? confidence
      : null;
  }

  private readOptionalBooleanLike(value: unknown): boolean | number {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value === 1 ? 1 : 0;
    }
    return false;
  }

  private readOptionalBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === 'true' || value === '1';
  }

  private normalizeUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
      return trimmed;
    }
    if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/.*)?$/i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }

  private truncateSummary(content: string): string {
    return content.length > 200 ? `${content.slice(0, 200)}...` : content;
  }

  private formatDateOnly(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private resolveErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async safeRecordAuditLog(input: {
    durationMs: number;
    errorMessage: string;
    model?: string;
    prompt: string;
    rawResponse?: null | string;
    taskId: string;
    tokenUsage?: null | unknown;
  }): Promise<void> {
    try {
      await this.auditLogService.record({
        durationMs: input.durationMs,
        errorMessage: input.errorMessage,
        model: input.model,
        prompt: input.prompt,
        rawResponse: input.rawResponse ?? null,
        taskId: input.taskId,
        tokenUsage: input.tokenUsage ?? null,
      });
    } catch (auditError) {
      console.error('[AI_AUDIT_LOG_RECORD_FAILED]', auditError);
    }
  }
}
