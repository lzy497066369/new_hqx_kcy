import { BadRequestException, Injectable } from '@nestjs/common';

import { AiGatewayService } from '../ai-gateway.service';
import type { AiSceneContext, AiSceneRunResult } from '../ai.types';

@Injectable()
export class PolicyParseScene {
  constructor(private readonly aiGateway: AiGatewayService) {}

  async run(context: AiSceneContext): Promise<AiSceneRunResult> {
    const prompt = this.buildPrompt(context);
    const response = await this.aiGateway.chat({
      messages: [
        {
          content:
            'You are an assistant for Chinese enterprise policy operations. Return only valid JSON.',
          role: 'system',
        },
        {
          content: prompt,
          role: 'user',
        },
      ],
      responseFormat: 'json_object',
    });
    const structuredResult = this.parseJsonObject(response.content);

    return {
      confidence: this.normalizeConfidenceLabel(structuredResult.confidence),
      prompt,
      rawResponse: JSON.stringify(response.rawResponse),
      structuredResult,
      summary: this.getStringField(structuredResult, 'summary'),
      tokenUsage: response.tokenUsage,
    };
  }

  private buildPrompt(context: AiSceneContext): string {
    return [
      'Parse the following Chinese policy file into a structured JSON object.',
      'The JSON schema must be:',
      '{',
      '  "summary": string,',
      '  "policyName": string,',
      '  "region": string,',
      '  "projectName": string,',
      '  "targetObjects": string[],',
      '  "conditions": string[],',
      '  "materials": string[],',
      '  "startDate": string | null,',
      '  "endDate": string | null,',
      '  "subsidy": string,',
      '  "department": string | null,',
      '  "risks": string[],',
      '  "nextActions": string[],',
      '  "confidence": "low" | "medium" | "high"',
      '}',
      '',
      'Use null or empty arrays when the source text does not contain enough information.',
      'Do not invent facts.',
      '',
      `Business title: ${context.title}`,
      `Business data JSON: ${JSON.stringify(context.data)}`,
    ].join('\n');
  }

  private parseJsonObject(value: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through to a clear API error.
    }
    throw new BadRequestException('AI response is not a valid JSON object');
  }

  private getStringField(
    value: Record<string, unknown>,
    key: string,
  ): null | string {
    const field = value[key];
    return typeof field === 'string' && field.trim() ? field : null;
  }

  private normalizeConfidenceLabel(value: unknown): null | string {
    const confidence =
      typeof value === 'string' ? value.trim().toLowerCase() : null;
    return confidence === 'high' || confidence === 'medium' || confidence === 'low'
      ? confidence
      : null;
  }
}
