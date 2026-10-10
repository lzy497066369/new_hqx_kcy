import { Body, Controller, Get, Headers, Ip, Post, UnauthorizedException, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from './access-token.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginThrottleService } from './login-throttle.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly throttle: LoginThrottleService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Ip() ip: string) {
    const keys = this.throttle.keys('iam-admin', dto.username, ip);
    this.throttle.assertAllowed(keys);
    try {
      const result = await this.authService.login(dto);
      this.throttle.clear(keys);
      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) this.throttle.recordFailure(keys);
      throw error;
    }
  }

  @Get('codes')
  @UseGuards(AccessTokenGuard)
  async codes(@Headers('authorization') authorization?: string) {
    return this.authService.getAccessCodes(this.extractBearerToken(authorization));
  }

  @Post('logout')
  async logout(@Headers('authorization') authorization?: string) {
    await this.authService.logout(this.extractBearerTokenOrNull(authorization));
    return null;
  }

  private extractBearerToken(authorization?: string): string {
    const [scheme, accessToken] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !accessToken) {
      throw new Error('Access token should have been validated by AccessTokenGuard');
    }
    return accessToken;
  }

  private extractBearerTokenOrNull(authorization?: string): null | string {
    const [scheme, accessToken] = authorization?.split(' ') ?? [];
    return scheme === 'Bearer' && accessToken ? accessToken : null;
  }
}
