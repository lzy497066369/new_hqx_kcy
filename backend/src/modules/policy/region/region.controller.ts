import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { RequirePermissions } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import type { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { RegionInput } from './dto';
import { PolicyRegionService } from './region.service';

@Controller('policy/regions')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class PolicyRegionController {
  constructor(private readonly regionService: PolicyRegionService) {}

  @Get()
  @RequirePermissions('Policy:Region:List')
  async list(
    @Query() query: Record<string, string | string[] | undefined>,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.regionService.list(query, currentUser);
  }

  @Get('tree')
  @RequirePermissions('Policy:Region:List')
  async tree(
    @Query() query: Record<string, string | string[] | undefined>,
    @CurrentUserInfo() currentUser: CurrentUser,
  ): Promise<unknown> {
    return this.regionService.tree(query, currentUser);
  }

  @Post()
  @RequirePermissions('Policy:Region:Create')
  @OperationLog({ module: '政策管理-区域管理', action: '新增区域' })
  async create(@Body() body: RegionInput): Promise<unknown> {
    return this.regionService.create(body);
  }

  @Put(':id')
  @RequirePermissions('Policy:Region:Edit')
  @OperationLog({ module: '政策管理-区域管理', action: '修改区域' })
  async update(@Param('id') id: string, @Body() body: RegionInput): Promise<unknown> {
    return this.regionService.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('Policy:Region:Delete')
  @OperationLog({ module: '政策管理-区域管理', action: '删除区域' })
  async remove(@Param('id') id: string) {
    await this.regionService.remove(id);
    return null;
  }
}
