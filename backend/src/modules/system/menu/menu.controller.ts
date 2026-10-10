import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { RequirePermissions } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { DEFAULT_PORTAL_TYPE } from '../../../common/types/portal-type';
import { DEFAULT_AUTH_APP_CODE } from '../../auth/auth-runtime.config';
import { MenuInput } from './dto';
import { SystemMenuService } from './menu.service';
import { resolveManagedPortalType } from '../shared/system.utils';

@Controller('system/menu')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class SystemMenuController {
  constructor(private readonly menuService: SystemMenuService) {}

  @Get('list')
  @RequirePermissions('System:Menu:List')
  async list(
    @CurrentUserInfo() user: CurrentUser,
    @Query('portalType') portalType?: string,
  ): Promise<unknown> {
    return this.menuService.list(
      resolveManagedPortalType(portalType, user.portal ?? DEFAULT_PORTAL_TYPE),
      user.appCode ?? DEFAULT_AUTH_APP_CODE,
    );
  }

  @Get('name-exists')
  @RequirePermissions('System:Menu:List')
  async nameExists(
    @CurrentUserInfo() user: CurrentUser,
    @Query('name') name: string,
    @Query('portalType') portalType?: string,
    @Query('id') id?: string,
  ) {
    return this.menuService.isNameExists(
      name ?? '',
      resolveManagedPortalType(portalType, user.portal ?? DEFAULT_PORTAL_TYPE),
      user.appCode ?? DEFAULT_AUTH_APP_CODE,
      id,
    );
  }

  @Get('path-exists')
  @RequirePermissions('System:Menu:List')
  async pathExists(
    @CurrentUserInfo() user: CurrentUser,
    @Query('path') path: string,
    @Query('portalType') portalType?: string,
    @Query('id') id?: string,
  ) {
    return this.menuService.isPathExists(
      path ?? '',
      resolveManagedPortalType(portalType, user.portal ?? DEFAULT_PORTAL_TYPE),
      user.appCode ?? DEFAULT_AUTH_APP_CODE,
      id,
    );
  }

  @Post()
  @RequirePermissions('System:Menu:Create')
  @OperationLog({ module: '系统管理-菜单', action: '新增菜单' })
  async create(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: MenuInput,
  ): Promise<unknown> {
    return this.menuService.create(
      body,
      user.portal ?? DEFAULT_PORTAL_TYPE,
      user.appCode ?? DEFAULT_AUTH_APP_CODE,
    );
  }

  @Put(':id')
  @RequirePermissions('System:Menu:Edit')
  @OperationLog({ module: '系统管理-菜单', action: '修改菜单' })
  async update(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: MenuInput,
  ): Promise<unknown> {
    return this.menuService.update(
      id,
      body,
      user.portal ?? DEFAULT_PORTAL_TYPE,
      user.appCode ?? DEFAULT_AUTH_APP_CODE,
    );
  }

  @Delete(':id')
  @RequirePermissions('System:Menu:Delete')
  @OperationLog({ module: '系统管理-菜单', action: '删除菜单' })
  async remove(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Query('portalType') portalType?: string,
  ) {
    await this.menuService.remove(
      id,
      resolveManagedPortalType(portalType, user.portal ?? DEFAULT_PORTAL_TYPE),
      user.appCode ?? DEFAULT_AUTH_APP_CODE,
    );
    return null;
  }
}
