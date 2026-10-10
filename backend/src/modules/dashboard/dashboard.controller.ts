import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { RequirePortals } from '../../common/decorators/require-portal.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { PortalGuard } from '../../common/guards/portal.guard';
import type { CurrentUser } from '../../common/interfaces/current-user.interface';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AccessTokenGuard, PortalGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin/analytics')
  @RequirePortals('admin')
  getAdminAnalytics(@CurrentUserInfo() currentUser: CurrentUser) {
    return this.dashboardService.getAdminAnalytics(currentUser);
  }

  @Get('admin/workbench')
  @RequirePortals('admin')
  getAdminWorkbench(@CurrentUserInfo() currentUser: CurrentUser) {
    return this.dashboardService.getAdminWorkbench(currentUser);
  }

  @Get('client/analytics')
  @RequirePortals('client')
  getClientAnalytics(@CurrentUserInfo() currentUser: CurrentUser) {
    return this.dashboardService.getClientAnalytics(currentUser);
  }

  @Get('client/workbench')
  @RequirePortals('client')
  getClientWorkbench(@CurrentUserInfo() currentUser: CurrentUser) {
    return this.dashboardService.getClientWorkbench(currentUser);
  }

  @Get('client/todos')
  @RequirePortals('client')
  getClientTodos(@CurrentUserInfo() currentUser: CurrentUser) {
    return this.dashboardService.getClientTodos(currentUser);
  }
}
