import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Body, Controller, Delete, Get, Param, Post, Query, Res, UploadedFile, UseInterceptors, UseGuards } from '@nestjs/common';

import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { RequirePortals } from '../../common/decorators/require-portal.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { PortalGuard } from '../../common/guards/portal.guard';
import type { CurrentUser } from '../../common/interfaces/current-user.interface';
import { ConfirmGovernanceExcelDto, ExportGovernanceExcelDto, PreviewGovernanceExcelDto, AssignProjectEnterprisesDto, CreateGovernanceAccountDto, CreateGovernanceEnterpriseDto, DistributeEnterpriseDto } from './dto';
import { ClientGovernanceExcelService } from './governance-excel.service';
import { ClientGovernanceService } from './governance.service';

@Controller('client/governance')
@RequirePortals('client')
@UseGuards(AccessTokenGuard, PortalGuard)
export class ClientGovernanceController {
  constructor(private readonly governance: ClientGovernanceService, private readonly excel: ClientGovernanceExcelService) {}

  @Get('overview') overview(@CurrentUserInfo() user: CurrentUser) { return this.governance.overview(user); }
  @Get('enterprises/excel/template')
  async excelTemplate(@CurrentUserInfo() user: CurrentUser, @Res() response: Response) {
    this.sendExcel(response, await this.excel.export(user, {}, true), '企业建档模板.xlsx');
  }
  @Get('enterprises/excel/export')
  async excelExport(@CurrentUserInfo() user: CurrentUser, @Query() query: ExportGovernanceExcelDto, @Res() response: Response) {
    this.sendExcel(response, await this.excel.export(user, query), '企业档案.xlsx');
  }
  @Post('enterprises/excel/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 3 } }))
  excelPreview(@CurrentUserInfo() user: CurrentUser, @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined, @Body() body: PreviewGovernanceExcelDto) {
    return this.excel.preview(user, file, body);
  }
  @Post('enterprises/excel/confirm')
  excelConfirm(@CurrentUserInfo() user: CurrentUser, @Body() body: ConfirmGovernanceExcelDto) { return this.excel.confirm(user, body.token); }
  @Get('enterprises/excel/issues/:token')
  async excelIssues(@CurrentUserInfo() user: CurrentUser, @Param('token') token: string, @Res() response: Response) {
    this.sendExcel(response, await this.excel.issues(user, token), '企业建档导入问题明细.xlsx');
  }
  private sendExcel(response: Response, buffer: Buffer, filename: string) {
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    response.setHeader('Cache-Control', 'no-store');
    response.send(buffer);
  }
  @Get('enterprises/:id') enterpriseDetail(@CurrentUserInfo() user: CurrentUser, @Param('id') id: string) { return this.governance.enterpriseDetail(user, id); }
  @Post('enterprises') createEnterprise(@CurrentUserInfo() user: CurrentUser, @Body() body: CreateGovernanceEnterpriseDto) { return this.governance.createEnterprise(user, body); }
  @Post('enterprises/:id/distribute') distributeEnterprise(@CurrentUserInfo() user: CurrentUser, @Param('id') id: string, @Body() body: DistributeEnterpriseDto) { return this.governance.assignEnterprises(user, body.projectUserId, [id]); }
  @Post('accounts') createAccount(@CurrentUserInfo() user: CurrentUser, @Body() body: CreateGovernanceAccountDto) { return this.governance.createAccount(user, body); }
  @Post('project-accounts/:id/enterprises') assignEnterprises(@CurrentUserInfo() user: CurrentUser, @Param('id') id: string, @Body() body: AssignProjectEnterprisesDto) { return this.governance.assignEnterprises(user, id, body.enterpriseIds); }
  @Delete('accounts/:id') deleteAccount(@CurrentUserInfo() user: CurrentUser, @Param('id') id: string) { return this.governance.deleteAccount(user, id); }
  @Delete('enterprises/:id') deleteEnterprise(@CurrentUserInfo() user: CurrentUser, @Param('id') id: string) { return this.governance.deleteEnterprise(user, id); }
}
