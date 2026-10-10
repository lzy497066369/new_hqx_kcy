import { Module } from '@nestjs/common';

import { AccessTokenGuard } from './access-token.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginThrottleService } from './login-throttle.service';

@Module({
  controllers: [AuthController],
  exports: [AccessTokenGuard, AuthService, LoginThrottleService],
  providers: [AuthService, AccessTokenGuard, LoginThrottleService],
})
export class AuthModule {}
