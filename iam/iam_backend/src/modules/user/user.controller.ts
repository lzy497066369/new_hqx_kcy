import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import {
  AccessTokenGuard,
  type AuthenticatedRequest,
} from '../auth/access-token.guard';

@Controller('user')
export class UserController {
  @Get('info')
  @UseGuards(AccessTokenGuard)
  info(@Req() request: AuthenticatedRequest) {
    return request.iamUser!;
  }
}
