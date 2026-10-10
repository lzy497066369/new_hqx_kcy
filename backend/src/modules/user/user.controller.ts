import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { UpdatePasswordDto, UpdateProfileDto } from './dto';
import { UserService } from './user.service';

type RequestWithCurrentUser = Request & {
  currentUser: CurrentUser;
};

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('info')
  @UseGuards(AccessTokenGuard)
  info(@Req() request: RequestWithCurrentUser) {
    return this.userService.getProfile(
      request.currentUser.id,
      request.currentUser.portal,
      request,
    );
  }

  @Post('profile')
  @UseGuards(AccessTokenGuard)
  updateProfile(
    @Req() request: RequestWithCurrentUser,
    @Body() body: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(
      request.currentUser.id,
      body,
      request.currentUser.portal,
      request,
    );
  }

  @Post('password')
  @UseGuards(AccessTokenGuard)
  updatePassword(
    @Req() request: RequestWithCurrentUser,
    @Body() body: UpdatePasswordDto,
  ) {
    return this.userService.updatePassword(request.currentUser.id, body);
  }
}
