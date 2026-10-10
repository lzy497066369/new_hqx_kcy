import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { RequirePermissions } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import type { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { AiService } from '../../ai/ai.service';
import { RegionPolicyFileInput } from './dto';
import { RegionPolicyFileService } from './file.service';

@Controller('policy/files')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class RegionPolicyFileController {
  constructor(
    private readonly aiService: AiService,
    private readonly fileService: RegionPolicyFileService,
  ) {}

  @Get()
  @RequirePermissions('Policy:File:List')
  async list(
    @Req() request: Request,
    @Query() query: Record<string, string | string[] | undefined>,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.fileService.list(query, request, currentUser);
  }

  @Get('defaults')
  @RequirePermissions('Policy:File:List')
  async getDefaults(
    @Query() query: Record<string, string | string[] | undefined>,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.fileService.getDefaults(query, currentUser);
  }

  @Post('ai-parse-draft')
  @RequirePermissions('Policy:File:Edit')
  async parseDraftByAi(
    @Body() body: RegionPolicyFileInput,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.aiService.parsePolicyFileDraft(body, currentUser);
  }

  @Get(':id')
  @RequirePermissions('Policy:File:List')
  async detail(
    @Req() request: Request,
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.fileService.detail(id, request, currentUser);
  }

  @Post()
  @RequirePermissions('Policy:File:Create')
  @OperationLog({
    module: '政策管理-区域政策文件',
    action: '新增政策文件',
  })
  async create(
    @Req() request: Request,
    @Body() body: RegionPolicyFileInput,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.fileService.create(body, request, currentUser);
  }

  @Put(':id')
  @RequirePermissions('Policy:File:Edit')
  @OperationLog({
    module: '政策管理-区域政策文件',
    action: '修改政策文件',
  })
  async update(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: RegionPolicyFileInput,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.fileService.update(id, body, request, currentUser);
  }

  @Post(':id/publish')
  @RequirePermissions('Policy:File:Edit')
  @OperationLog({
    module: '政策管理-区域政策文件',
    action: '发布政策文件',
  })
  async publish(
    @Req() request: Request,
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.fileService.publish(id, request, currentUser);
  }

  @Post(':id/archive')
  @RequirePermissions('Policy:File:Edit')
  @OperationLog({
    module: '政策管理-区域政策文件',
    action: '归档政策文件',
  })
  async archive(
    @Req() request: Request,
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.fileService.archive(id, request, currentUser);
  }

  @Post(':id/expire')
  @RequirePermissions('Policy:File:Edit')
  @OperationLog({
    module: '政策管理-区域政策文件',
    action: '过期政策文件',
  })
  async expire(
    @Req() request: Request,
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.fileService.expire(id, request, currentUser);
  }

  @Post(':id/incomplete')
  @RequirePermissions('Policy:File:Edit')
  @OperationLog({
    module: '政策管理-区域政策文件',
    action: '标记未完善政策文件',
  })
  async markIncomplete(
    @Req() request: Request,
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.fileService.markIncomplete(id, request, currentUser);
  }

  @Delete(':id')
  @RequirePermissions('Policy:File:Delete')
  @OperationLog({
    module: '政策管理-区域政策文件',
    action: '删除政策文件',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUserInfo() currentUser: CurrentUser,
  ) {
    await this.fileService.remove(id, currentUser);
    return null;
  }
}
