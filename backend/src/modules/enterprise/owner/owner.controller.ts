import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { RequirePermissions } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { EnterpriseOwnerInput } from './dto';
import { EnterpriseOwnerService } from './owner.service';

@Controller('enterprise/owner')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class EnterpriseOwnerController {
  constructor(private readonly ownerService: EnterpriseOwnerService) {}

  @Get('list')
  @RequirePermissions('Enterprise:Owner:List')
  async list(@Query() query: Record<string, string | string[] | undefined>): Promise<unknown> {
    return this.ownerService.list(query);
  }

  @Get(':id')
  @RequirePermissions('Enterprise:Owner:List')
  async detail(@Param('id') id: string): Promise<unknown> {
    return this.ownerService.detail(id);
  }

  @Post()
  @RequirePermissions('Enterprise:Owner:Create')
  @OperationLog({ module: '企业管理-企业负责人', action: '新增企业负责人' })
  async create(@Body() body: EnterpriseOwnerInput): Promise<unknown> {
    return this.ownerService.create(body);
  }

  @Put(':id')
  @RequirePermissions('Enterprise:Owner:Edit')
  @OperationLog({ module: '企业管理-企业负责人', action: '修改企业负责人' })
  async update(@Param('id') id: string, @Body() body: EnterpriseOwnerInput): Promise<unknown> {
    return this.ownerService.update(id, body);
  }

  @Post(':id/reset-password')
  @RequirePermissions('Enterprise:Owner:Edit')
  @OperationLog({ module: '企业管理-企业负责人', action: '重置企业负责人密码' })
  async resetPassword(@Param('id') id: string) {
    await this.ownerService.resetPassword(id);
    return null;
  }

  @Delete(':id')
  @RequirePermissions('Enterprise:Owner:Delete')
  @OperationLog({ module: '企业管理-企业负责人', action: '删除企业负责人' })
  async remove(@Param('id') id: string) {
    await this.ownerService.remove(id);
    return null;
  }
}
