import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { MenuService } from './menu.service';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('all')
  @UseGuards(AccessTokenGuard)
  async all(@Req() request: { currentUser: CurrentUser }) {
    return this.menuService.getMenus(request.currentUser);
  }
}
