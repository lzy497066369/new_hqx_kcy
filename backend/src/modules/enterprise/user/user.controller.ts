import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { RequirePermissions } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { EnterpriseUserInput } from './dto';
import { EnterpriseUserService } from './user.service';

@Controller('enterprise/user')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class EnterpriseUserController {
  constructor(private readonly enterpriseUserService: EnterpriseUserService) {}

  @Get('list')
  @RequirePermissions('Enterprise:User:List')
  async list(
    @CurrentUserInfo() user: CurrentUser,
    @Query() query: Record<string, string | string[] | undefined>,
  ): Promise<unknown> {
    return this.enterpriseUserService.list(query, user);
  }

  @Get(':id')
  @RequirePermissions('Enterprise:User:List')
  async detail(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.enterpriseUserService.detail(id, user);
  }

  @Post()
  @RequirePermissions('Enterprise:User:Create')
  @OperationLog({ module: '企业管理-企业用户', action: '新增企业用户' })
  async create(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: EnterpriseUserInput,
  ): Promise<unknown> {
    return this.enterpriseUserService.create(body, user);
  }

  @Put(':id')
  @RequirePermissions('Enterprise:User:Edit')
  @OperationLog({ module: '企业管理-企业用户', action: '修改企业用户' })
  async update(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: EnterpriseUserInput,
  ): Promise<unknown> {
    return this.enterpriseUserService.update(id, body, user);
  }

  @Post(':id/reset-password')
  @RequirePermissions('Enterprise:User:Edit')
  @OperationLog({ module: '企业管理-企业用户', action: '重置企业用户密码' })
  async resetPassword(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    await this.enterpriseUserService.resetPassword(id, user);
    return null;
  }

  @Delete(':id')
  @RequirePermissions('Enterprise:User:Delete')
  @OperationLog({ module: '企业管理-企业用户', action: '删除企业用户' })
  async remove(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    await this.enterpriseUserService.remove(id, user);
    return null;
  }
}
