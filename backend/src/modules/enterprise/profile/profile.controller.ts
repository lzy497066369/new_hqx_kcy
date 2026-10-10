import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { RequirePermissions } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { EnterpriseInput } from './dto';
import { EnterpriseProfileExcelService } from './profile-excel.service';
import { EnterpriseProfileService } from './profile.service';

@Controller('enterprise/profile')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class EnterpriseProfileController {
  constructor(
    private readonly enterpriseProfileService: EnterpriseProfileService,
    private readonly enterpriseProfileExcelService: EnterpriseProfileExcelService,
  ) {}

  @Get('list')
  @RequirePermissions('Enterprise:Profile:List')
  async list(
    @CurrentUserInfo() user: CurrentUser,
    @Query() query: Record<string, string | string[] | undefined>,
  ): Promise<unknown> {
    return this.enterpriseProfileService.list(query, user);
  }


  @Get('excel/template')
  @RequirePermissions('Enterprise:Profile:Create')
  async excelTemplate(
    @CurrentUserInfo() user: CurrentUser,
    @Res() response: Response,
  ) {
    this.sendExcel(
      response,
      await this.enterpriseProfileExcelService.export(user, true),
      '企业档案导入模板.xlsx',
    );
  }

  @Get('excel/export')
  @RequirePermissions('Enterprise:Profile:List')
  async excelExport(
    @CurrentUserInfo() user: CurrentUser,
    @Res() response: Response,
  ) {
    this.sendExcel(
      response,
      await this.enterpriseProfileExcelService.export(user),
      '企业档案.xlsx',
    );
  }

  @Post('excel/import')
  @RequirePermissions('Enterprise:Profile:Create')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1 },
    }),
  )
  @OperationLog({ module: '企业管理-企业资料', action: 'Excel批量导入企业资料' })
  async excelImport(
    @CurrentUserInfo() user: CurrentUser,
    @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined,
  ) {
    return this.enterpriseProfileExcelService.import(user, file);
  }

  private sendExcel(response: Response, buffer: Buffer, filename: string) {
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    response.setHeader('Cache-Control', 'no-store');
    response.send(buffer);
  }

  @Get(':id')
  @RequirePermissions('Enterprise:Profile:List')
  async detail(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.enterpriseProfileService.detail(id, user);
  }

  @Post()
  @RequirePermissions('Enterprise:Profile:Create')
  @OperationLog({ module: '企业管理-企业资料', action: '新增企业资料' })
  async create(
    @Body() body: EnterpriseInput,
    @CurrentUserInfo() user: CurrentUser,
  ): Promise<unknown> {
    return this.enterpriseProfileService.create(body, user);
  }

  @Put(':id')
  @RequirePermissions('Enterprise:Profile:Edit')
  @OperationLog({ module: '企业管理-企业资料', action: '修改企业资料' })
  async update(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: EnterpriseInput,
  ): Promise<unknown> {
    return this.enterpriseProfileService.update(id, body, user);
  }

  @Delete(':id')
  @RequirePermissions('Enterprise:Profile:Delete')
  @OperationLog({ module: '企业管理-企业资料', action: '删除企业资料' })
  async remove(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    await this.enterpriseProfileService.remove(id, user);
    return null;
  }
}
