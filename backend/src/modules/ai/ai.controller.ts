import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { RequireRoles } from '../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import type { CurrentUser } from '../../common/interfaces/current-user.interface';
import { AiService } from './ai.service';
import {
  CreateAiChatTestDto,
  CreateAiTaskDto,
  UpdateAiResultStatusDto,
} from './dto';

@Controller('ai')
@RequireRoles('admin', 'super_admin')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('tasks')
  async createTask(
    @Body() body: CreateAiTaskDto,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.aiService.createTask(body, currentUser);
  }

  @Post('chat-test')
  async chatTest(
    @Body() body: CreateAiChatTestDto,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.aiService.chatTest(body, currentUser);
  }

  @Post('chat-test/stream')
  async chatTestStream(
    @Body() body: CreateAiChatTestDto,
    @CurrentUserInfo() currentUser: CurrentUser,
    @Res() response: Response,
  ): Promise<void> {
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.flushHeaders?.();

    try {
      const result = await this.aiService.chatTestStream(
        body,
        currentUser,
        (content) => {
          response.write(`event: delta\ndata: ${JSON.stringify({ content })}\n\n`);
        },
      );
      response.write(`event: done\ndata: ${JSON.stringify(result)}\n\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      response.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    } finally {
      response.end();
    }
  }

  @Post('search-health-check')
  async searchHealthCheck(
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.aiService.searchHealthCheck(currentUser, { force: true });
  }

  @Get('tasks')
  async listTasks(
    @Query() query: Record<string, string | string[] | undefined>,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.aiService.listTasks(query, currentUser);
  }

  @Get('tasks/:id')
  async getTask(@Param('id') id: string): Promise<unknown> {
    return this.aiService.getTask(id);
  }

  @Get('audit-logs')
  async listAuditLogs(
    @Query() query: Record<string, string | string[] | undefined>,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.aiService.listAuditLogs(query, currentUser);
  }

  @Get('stats/summary')
  async getStatsSummary(
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.aiService.getStatsSummary(currentUser);
  }

  @Post('results/:id/confirm')
  async confirmResult(
    @Param('id') id: string,
    @Body() _body: UpdateAiResultStatusDto,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.aiService.confirmResult(id, currentUser);
  }

  @Post('results/:id/reject')
  async rejectResult(
    @Param('id') id: string,
    @Body() _body: UpdateAiResultStatusDto,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.aiService.rejectResult(id, currentUser);
  }
}
