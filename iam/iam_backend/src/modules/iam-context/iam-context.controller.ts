import { Controller, Get, Headers, Param, Put, UnauthorizedException } from '@nestjs/common';

import { IamContextService } from './iam-context.service';

@Controller('iam')
export class IamContextController {
  constructor(private readonly context: IamContextService) {}

  @Get('me') me(@Headers('authorization') authorization?: string) { return this.context.getMe(this.extractAccessToken(authorization)); }
  @Get('me/apps/:appCode/permissions') permissions(@Param('appCode') appCode: string, @Headers('authorization') authorization?: string) { return this.context.getPermissions(this.extractAccessToken(authorization), appCode); }
  @Get('me/apps/:appCode/menus') menus(@Param('appCode') appCode: string, @Headers('authorization') authorization?: string) { return this.context.getMenus(this.extractAccessToken(authorization), appCode); }
  @Get('me/apps/:appCode/companies') companies(@Param('appCode') appCode: string, @Headers('authorization') authorization?: string) { return this.context.getCompanies(this.extractAccessToken(authorization), appCode); }
  @Put('me/apps/:appCode/companies/:companyId/default') defaultCompany(@Param('appCode') appCode: string, @Param('companyId') companyId: string, @Headers('authorization') authorization?: string) { return this.context.setDefaultCompany(this.extractAccessToken(authorization), appCode, companyId); }

  private extractAccessToken(authorization?: string): string {
    const [scheme, accessToken] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !accessToken) throw new UnauthorizedException('Bearer access token is required');
    return accessToken;
  }
}
