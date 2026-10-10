import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { RequireRoles } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { EnterpriseImportConfirmInput } from './dto';
import { EnterpriseImportService } from './import.service';

@Controller('enterprise/import')
@RequireRoles('admin', 'super_admin', 'project_teacher')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class EnterpriseImportController {
  constructor(private readonly enterpriseImportService: EnterpriseImportService) {}

  @Get('search')
  async search(
    @Query('keyword') keyword: string,
    @CurrentUserInfo() user: CurrentUser,
  ): Promise<unknown> {
    if (user.portal === 'client') throw new ForbiddenException('请联系管理人员统一建档并分发');
    return this.enterpriseImportService.search(keyword, user);
  }

  @Get('preview')
  async preview(
    @Query('externalId') externalId: string,
    @CurrentUserInfo() user: CurrentUser,
  ): Promise<unknown> {
    if (user.portal === 'client') throw new ForbiddenException('请联系管理人员统一建档并分发');
    return this.enterpriseImportService.preview(externalId, user);
  }

  @Post('confirm')
  @OperationLog({ module: '企业管理-企业资料', action: '天眼查导入企业' })
  async confirm(
    @Body() body: EnterpriseImportConfirmInput,
    @CurrentUserInfo() user: CurrentUser,
  ): Promise<unknown> {
    if (user.portal === 'client') throw new ForbiddenException('请联系管理人员统一建档并分发');
    return this.enterpriseImportService.confirm(body, user);
  }
}
