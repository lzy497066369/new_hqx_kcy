import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import type { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { PolicyCollectService } from './collect.service';
import type {
  PolicyCollectJobInput,
  PolicyCollectReviewPolicyFileInput,
} from './dto';

@Controller('policy')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class PolicyCollectController {
  constructor(private readonly collectService: PolicyCollectService) {}

  @Get('collect-jobs')
  @RequirePermissions('Policy:CollectJob:List')
  async listJobs(
    @Query() query: Record<string, string | string[] | undefined>,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.listJobs(query, currentUser);
  }

  @Get('collect-jobs/:id')
  @RequirePermissions('Policy:CollectJob:List')
  async getJob(
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.getJob(id, currentUser);
  }

  @Post('collect-jobs')
  @RequirePermissions('Policy:CollectJob:List')
  async createJob(
    @Body() body: PolicyCollectJobInput,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.createJob(body, currentUser);
  }

  @Put('collect-jobs/:id')
  @RequirePermissions('Policy:CollectJob:List')
  async updateJob(
    @Param('id') id: string,
    @Body() body: PolicyCollectJobInput,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.updateJob(id, body, currentUser);
  }

  @Post('collect-jobs/:id/enable')
  @RequirePermissions('Policy:CollectJob:List')
  async enableJob(
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.setJobEnabled(id, 1, currentUser);
  }

  @Post('collect-jobs/:id/disable')
  @RequirePermissions('Policy:CollectJob:List')
  async disableJob(
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.setJobEnabled(id, 0, currentUser);
  }

  @Post('collect-jobs/:id/run')
  @RequirePermissions('Policy:CollectJob:List')
  async runJob(
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.startJobRun(id, currentUser);
  }

  @Delete('collect-jobs/:id')
  @RequirePermissions('Policy:CollectJob:List')
  async removeJob(
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    await this.collectService.removeJob(id, currentUser);
    return null;
  }

  @Get('collect-runs')
  @RequirePermissions('Policy:CollectRun:List')
  async listRuns(
    @Query() query: Record<string, string | string[] | undefined>,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.listRuns(query, currentUser);
  }

  @Get('collect-runs/:id')
  @RequirePermissions('Policy:CollectRun:List')
  async getRun(
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.getRun(id, currentUser);
  }

  @Get('collect-runs/:id/items')
  @RequirePermissions('Policy:CollectRun:List')
  async listRunItems(
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.listRunItems(id, currentUser);
  }

  @Get('collect-runs/:id/progress-stream')
  @RequirePermissions('Policy:CollectRun:List')
  async streamRunProgress(
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.flushHeaders?.();

    let closed = false;
    let writing = false;
    const writeSnapshot = async () => {
      if (closed || writing) {
        return;
      }
      writing = true;
      try {
        const run = await this.collectService.getRun(id, currentUser);
        response.write(`event: progress\ndata: ${JSON.stringify(run)}\n\n`);
        const status =
          run && typeof run === 'object'
            ? (run as { status?: unknown }).status
            : null;
        if (status === 'success' || status === 'failed') {
          response.write(`event: done\ndata: ${JSON.stringify(run)}\n\n`);
          closed = true;
          response.end();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        response.write(
          `event: error\ndata: ${JSON.stringify({ message })}\n\n`,
        );
        closed = true;
        response.end();
      } finally {
        writing = false;
      }
    };

    await writeSnapshot();
    if (closed) {
      return;
    }
    const timer = setInterval(writeSnapshot, 2000);
    response.on('close', () => {
      closed = true;
      clearInterval(timer);
    });
  }

  @Get('collect-review-items')
  @RequirePermissions('Policy:CollectReview:List')
  async listReviewItems(
    @Query() query: Record<string, string | string[] | undefined>,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.listReviewItems(query, currentUser);
  }

  @Get('collect-review-items/:id')
  @RequirePermissions('Policy:CollectReview:List')
  async getReviewItem(
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.getReviewItem(id, currentUser);
  }

  @Post('collect-review-items/:id/import')
  @RequirePermissions('Policy:CollectReview:List')
  async importReviewItem(
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.importReviewItem(id, currentUser);
  }

  @Post('collect-review-items/:id/save-as-new')
  @RequirePermissions('Policy:CollectReview:List')
  async saveReviewItemAsNew(
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.importReviewItem(id, currentUser);
  }

  @Post('collect-review-items/:id/update-existing')
  @RequirePermissions('Policy:CollectReview:List')
  async updateExistingPolicyFile(
    @Param('id') id: string,
    @Body() body: PolicyCollectReviewPolicyFileInput,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.updateExistingPolicyFile(id, body, currentUser);
  }

  @Post('collect-review-items/:id/link-existing')
  @RequirePermissions('Policy:CollectReview:List')
  async linkExistingPolicyFile(
    @Param('id') id: string,
    @Body() body: PolicyCollectReviewPolicyFileInput,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.linkExistingPolicyFile(id, body, currentUser);
  }

  @Post('collect-review-items/:id/ignore')
  @RequirePermissions('Policy:CollectReview:List')
  async ignoreReviewItem(
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.ignoreReviewItem(id, currentUser);
  }

  @Get('collect-notifications')
  @RequirePermissions('Policy:CollectWorkbench:View')
  async listNotifications(
    @Query() query: Record<string, string | string[] | undefined>,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.listNotifications(query, currentUser);
  }

  @Get('collect-notifications/:id')
  @RequirePermissions('Policy:CollectWorkbench:View')
  async getNotification(
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.getNotification(id, currentUser);
  }

  @Post('collect-notifications/:id/read')
  @RequirePermissions('Policy:CollectWorkbench:View')
  async markNotificationRead(
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    return this.collectService.markNotificationRead(id, currentUser);
  }

  @Get('collect-workbench/summary')
  @RequirePermissions('Policy:CollectWorkbench:View')
  async getWorkbenchSummary(@CurrentUserInfo() currentUser: CurrentUser) {
    return this.collectService.getWorkbenchSummary(currentUser);
  }
}
