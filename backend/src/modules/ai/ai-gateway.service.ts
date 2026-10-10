import { Injectable } from '@nestjs/common';

import type {
  AiChatRequest,
  AiChatResponse,
  AiChatStreamChunk,
  AiChatStreamResult,
} from './ai.types';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

@Injectable()
export class AiGatewayService {
  constructor(private readonly provider: OpenAiCompatibleProvider) {}

  async chat(input: AiChatRequest): Promise<AiChatResponse> {
    return this.provider.chat(input);
  }

  async stream(
    input: AiChatRequest,
    onChunk: (chunk: AiChatStreamChunk) => void | Promise<void>,
  ): Promise<AiChatStreamResult> {
    return this.provider.stream(input, onChunk);
  }
}
