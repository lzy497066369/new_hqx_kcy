import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { RequirePermissions } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { DEFAULT_PORTAL_TYPE } from '../../../common/types/portal-type';
import { resolveManagedPortalType } from '../shared/system.utils';
import { UserInput } from './dto';
import { SystemUserService } from './user.service';

@Controller('system/user')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class SystemUserController {
  constructor(private readonly userService: SystemUserService) {}

  @Get('list')
  @RequirePermissions('System:User:List')
  async list(
    @CurrentUserInfo() user: CurrentUser,
    @Query() query: Record<string, string | string[] | undefined>,
  ): Promise<unknown> {
    return this.userService.list(
      query,
      resolveManagedPortalType(
        query.portalType,
        user.portal ?? DEFAULT_PORTAL_TYPE,
      ),
      user,
    );
  }

  @Post()
  @RequirePermissions('System:User:Create')
  @OperationLog({ module: '系统管理-用户', action: '新增用户' })
  async create(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: UserInput,
  ): Promise<unknown> {
    return this.userService.create(body, user.portal ?? DEFAULT_PORTAL_TYPE);
  }

  @Put(':id')
  @RequirePermissions('System:User:Edit')
  @OperationLog({ module: '系统管理-用户', action: '修改用户' })
  async update(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: UserInput,
  ): Promise<unknown> {
    return this.userService.update(
      id,
      body,
      user.portal ?? DEFAULT_PORTAL_TYPE,
    );
  }

  @Delete(':id')
  @RequirePermissions('System:User:Delete')
  @OperationLog({ module: '系统管理-用户', action: '删除用户' })
  async remove(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Query('portalType') portalType?: string,
  ) {
    await this.userService.remove(
      id,
      resolveManagedPortalType(portalType, user.portal ?? DEFAULT_PORTAL_TYPE),
    );
    return null;
  }
}
