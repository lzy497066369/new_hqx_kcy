import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { SystemOperationLogService } from './operation-log.service';

@Controller('system/operation-log')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class SystemOperationLogController {
  constructor(
    private readonly operationLogService: SystemOperationLogService,
  ) {}

  @Get('list')
  @RequirePermissions('System:OperationLog:List')
  async list(
    @CurrentUserInfo() user: CurrentUser,
    @Query() query: Record<string, string | string[] | undefined>,
  ): Promise<unknown> {
    return this.operationLogService.list(query, user);
  }
}
