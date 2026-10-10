import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { RequirePortals } from '../../../common/decorators/require-portal.decorator';
import { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PortalGuard } from '../../../common/guards/portal.guard';
import { EnterpriseClientService } from './client.service';

@Controller('enterprise/client')
@RequirePortals('client')
@UseGuards(AccessTokenGuard, PortalGuard)
export class EnterpriseClientController {
  constructor(private readonly clientService: EnterpriseClientService) {}

  @Get('current')
  async currentEnterprise(@CurrentUserInfo() user: CurrentUser): Promise<unknown> {
    return this.clientService.getCurrentEnterprise(user.id);
  }
}
