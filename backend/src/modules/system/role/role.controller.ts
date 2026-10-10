import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { RequireRoles } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { DEFAULT_PORTAL_TYPE } from '../../../common/types/portal-type';
import { DEFAULT_AUTH_APP_CODE } from '../../auth/auth-runtime.config';
import { resolveManagedPortalType } from '../shared/system.utils';
import { RoleInput } from './dto';
import { SystemRoleService } from './role.service';

@Controller('system/role')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class SystemRoleController {
  constructor(private readonly roleService: SystemRoleService) {}

  @Get('list')
  @RequireRoles('admin', 'super_admin')
  async list(
    @CurrentUserInfo() user: CurrentUser,
    @Query() query: Record<string, string | string[] | undefined>,
  ): Promise<unknown> {
    return this.roleService.list(
      query,
      resolveManagedPortalType(
        query.portalType,
        user.portal ?? DEFAULT_PORTAL_TYPE,
      ),
      user.appCode ?? DEFAULT_AUTH_APP_CODE,
    );
  }

  @Post()
  @RequireRoles('admin', 'super_admin')
  @OperationLog({ module: '系统管理-角色', action: '新增角色' })
  async create(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: RoleInput,
  ): Promise<unknown> {
    return this.roleService.create(
      body,
      user.portal ?? DEFAULT_PORTAL_TYPE,
      user.appCode ?? DEFAULT_AUTH_APP_CODE,
    );
  }

  @Put(':id')
  @RequireRoles('admin', 'super_admin')
  @OperationLog({ module: '系统管理-角色', action: '修改角色' })
  async update(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: RoleInput,
  ): Promise<unknown> {
    return this.roleService.update(
      id,
      body,
      user.portal ?? DEFAULT_PORTAL_TYPE,
      user.appCode ?? DEFAULT_AUTH_APP_CODE,
    );
  }

  @Delete(':id')
  @RequireRoles('admin', 'super_admin')
  @OperationLog({ module: '系统管理-角色', action: '删除角色' })
  async remove(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Query('portalType') portalType?: string,
  ) {
    await this.roleService.remove(
      id,
      resolveManagedPortalType(portalType, user.portal ?? DEFAULT_PORTAL_TYPE),
      user.appCode ?? DEFAULT_AUTH_APP_CODE,
    );
    return null;
  }
}
