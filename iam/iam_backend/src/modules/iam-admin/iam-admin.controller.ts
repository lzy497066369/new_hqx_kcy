import { Body, Controller, Get, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/access-token.guard';
import { CompanyDto } from './dto/company.dto';
import { CompanyMemberDto } from './dto/company-member.dto';
import { PlatformDepartmentDto } from './dto/platform-department.dto';
import { UserPlatformDepartmentDto } from './dto/user-platform-department.dto';
import { AppDto } from './dto/app.dto';
import { UserDto } from './dto/user.dto';
import { UserAppDto } from './dto/user-app.dto';
import { OAuthClientDto } from './dto/oauth-client.dto';
import { IdListDto, MenuDto, PermissionDto, RoleDto, RoleListDto } from './dto/access-control.dto';
import { IamAdminService } from './iam-admin.service';
import { IamAdminAccessGuard } from './iam-admin-access.guard';
import { IamAuditService } from '../audit/iam-audit.service';
import { IamAdminAuditInterceptor } from './iam-admin-audit.interceptor';
import { IamAuditQueryDto } from '../audit/dto/iam-audit-query.dto';

@Controller('iam/admin')
@UseGuards(AccessTokenGuard, IamAdminAccessGuard)
@UseInterceptors(IamAdminAuditInterceptor)
export class IamAdminController {
  constructor(
    private readonly service: IamAdminService,
    private readonly audit: IamAuditService,
  ) {}

  @Get('apps') listApps() { return this.service.listApps(); }
  @Post('apps') createApp(@Body() dto: AppDto) { return this.service.createApp(dto); }
  @Put('apps/:id') updateApp(@Param('id') id: string, @Body() dto: AppDto) { return this.service.updateApp(id, dto); }
  @Get('users') listUsers() { return this.service.listUsers(); }
  @Post('users') createUser(@Body() dto: UserDto) { return this.service.createUser(dto); }
  @Put('users/:id') updateUser(@Param('id') id: string, @Body() dto: UserDto) { return this.service.updateUser(id, dto); }
  @Get('users/:id/apps') listUserApps(@Param('id') id: string) { return this.service.listUserApps(id); }
  @Put('users/:id/apps/:appCode') grantUserApp(@Param('id') id: string, @Param('appCode') appCode: string, @Body() dto: UserAppDto) { return this.service.grantUserApp(id, appCode, dto); }
  @Get('apps/:appCode/clients') listOAuthClients(@Param('appCode') appCode: string) { return this.service.listOAuthClients(appCode); }
  @Post('apps/:appCode/clients') createOAuthClient(@Param('appCode') appCode: string, @Body() dto: OAuthClientDto) { return this.service.createOAuthClient(appCode, dto); }
  @Put('apps/:appCode/clients/:clientId') updateOAuthClient(@Param('appCode') appCode: string, @Param('clientId') clientId: string, @Body() dto: OAuthClientDto) { return this.service.updateOAuthClient(appCode, clientId, dto); }
  @Get('apps/:appCode/roles') listRoles(@Param('appCode') appCode: string) { return this.service.listRoles(appCode); }
  @Post('apps/:appCode/roles') createRole(@Param('appCode') appCode: string, @Body() dto: RoleDto) { return this.service.createRole(appCode, dto); }
  @Put('apps/:appCode/roles/:roleId') updateRole(@Param('appCode') appCode: string, @Param('roleId') roleId: string, @Body() dto: RoleDto) { return this.service.updateRole(appCode, roleId, dto); }
  @Get('apps/:appCode/roles/:roleId/permissions') listRolePermissions(@Param('appCode') appCode: string, @Param('roleId') roleId: string) { return this.service.listRolePermissions(appCode, roleId); }
  @Put('apps/:appCode/roles/:roleId/permissions') setRolePermissions(@Param('appCode') appCode: string, @Param('roleId') roleId: string, @Body() dto: IdListDto) { return this.service.setRolePermissions(appCode, roleId, dto); }
  @Get('apps/:appCode/permissions') listPermissions(@Param('appCode') appCode: string) { return this.service.listPermissions(appCode); }
  @Post('apps/:appCode/permissions') createPermission(@Param('appCode') appCode: string, @Body() dto: PermissionDto) { return this.service.createPermission(appCode, dto); }
  @Put('apps/:appCode/permissions/:permissionId') updatePermission(@Param('appCode') appCode: string, @Param('permissionId') permissionId: string, @Body() dto: PermissionDto) { return this.service.updatePermission(appCode, permissionId, dto); }
  @Get('apps/:appCode/menus') listMenus(@Param('appCode') appCode: string) { return this.service.listMenus(appCode); }
  @Post('apps/:appCode/menus') createMenu(@Param('appCode') appCode: string, @Body() dto: MenuDto) { return this.service.createMenu(appCode, dto); }
  @Put('apps/:appCode/menus/:menuId') updateMenu(@Param('appCode') appCode: string, @Param('menuId') menuId: string, @Body() dto: MenuDto) { return this.service.updateMenu(appCode, menuId, dto); }
  @Put('users/:id/apps/:appCode/roles') setUserRoles(@Param('id') id: string, @Param('appCode') appCode: string, @Body() dto: RoleListDto) { return this.service.setUserRoles(id, appCode, dto); }
  @Get('users/:id/apps/:appCode/roles') listUserRoles(@Param('id') id: string, @Param('appCode') appCode: string) { return this.service.listUserRoles(id, appCode); }
  @Get('companies') listCompanies() { return this.service.listCompanies(); }
  @Get('audit/events') listAuditEvents(@Query() query: IamAuditQueryDto) { return this.audit.list(query); }
  // Company index records are provisioned by imports and sync jobs. The IAM UI does not expose company detail editing.
  @Post('companies') createCompany(@Body() dto: CompanyDto) { return this.service.createCompany(dto); }
  @Put('companies/:id') updateCompany(@Param('id') id: string, @Body() dto: CompanyDto) { return this.service.updateCompany(id, dto); }
  @Get('companies/:id/members') listMembers(@Param('id') id: string, @Query('appCode') appCode?: string) { return this.service.listCompanyMembers(id, appCode); }
  @Put('companies/:id/members') upsertMember(@Param('id') id: string, @Body() dto: CompanyMemberDto) { return this.service.upsertCompanyMember(id, dto); }
  @Get('platform-departments') listPlatformDepartments() { return this.service.listPlatformDepartments(); }
  @Post('platform-departments') createPlatformDepartment(@Body() dto: PlatformDepartmentDto) { return this.service.createPlatformDepartment(dto); }
  @Put('platform-departments/:id') updatePlatformDepartment(@Param('id') id: string, @Body() dto: PlatformDepartmentDto) { return this.service.updatePlatformDepartment(id, dto); }
  @Get('platform-departments/:id/members') listPlatformDepartmentMembers(@Param('id') id: string) { return this.service.listPlatformDepartmentMembers(id); }
  @Put('platform-departments/:id/members') upsertPlatformDepartmentMember(@Param('id') id: string, @Body() dto: UserPlatformDepartmentDto) { return this.service.upsertPlatformDepartmentMember(id, dto); }
}
