import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { UploadedFiles } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { IpPdfUpload } from './high-tech-ip-recognition.service';
import type { Response } from 'express';
import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { RequirePortals } from '../../../common/decorators/require-portal.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PortalGuard } from '../../../common/guards/portal.guard';
import type { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { HighTechService } from './high-tech.service';

@Controller('client/companies/:companyId/high-tech-application')
@RequirePortals('client')
@UseGuards(AccessTokenGuard, PortalGuard)
export class HighTechController {
  constructor(private readonly service: HighTechService) {}

  @Get()
  get(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string) {
    return this.service.get(user.id, companyId);
  }

  @Put()
  save(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Body() body: unknown) {
    return this.service.save(user.id, companyId, body);
  }

  @Get('scores')
  getScores(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string) {
    return this.service.getScores(user.id, companyId);
  }

  @Put('scores')
  saveScores(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Body() body: unknown) {
    return this.service.saveScores(user.id, companyId, body);
  }

  @Post('book/generate')
  generateBook(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Body() body: unknown) {
    return this.service.generateBook(user.id, companyId, body);
  }

  @Get('materials/staff')
  materialStaff(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string) {
    return this.service.materialStaff(user.id, companyId);
  }

  @Post('materials/import/:kind/:year')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 0 } }))
  importMaterial(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Param('kind') kind: string, @Param('year') year: string, @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined) {
    return this.service.importMaterial(user.id, companyId, kind, year, file);
  }

  @Get('materials/staff/template')
  async materialStaffTemplate(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Res() response: Response) {
    this.sendFile(response, await this.service.materialStaffTemplate(user.id, companyId), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '企业人员明细导入模板.xlsx');
  }

  @Post('documents/generate')
  generateDocument(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Body() body: unknown) {
    return this.service.generateDocument(user.id, companyId, body);
  }

  @Post('documents/export')
  async exportDocument(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Body() body: { key?: string; format?: string }, @Res() response: Response) {
    const result = await this.service.exportDocument(user.id, companyId, body);
    this.sendFile(response, result.buffer, body.format === 'pdf' ? 'application/pdf' : body.format === 'zip' ? 'application/zip' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', `${result.title}.${body.format === 'pdf' ? 'pdf' : body.format === 'zip' ? 'zip' : 'docx'}`);
  }

  @Get('book/export')
  async bookWord(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Res() response: Response) {
    const buffer = await this.service.bookWord(user.id, companyId);
    this.sendFile(response, buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '高新技术企业认定申请书-草稿.docx');
  }

  @Get('attachments')
  attachmentList(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string) {
    return this.service.attachmentList(user.id, companyId);
  }

  @Post('attachments/generate')
  generateAttachment(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Body() body: unknown) {
    return this.service.generateAttachment(user.id, companyId, body);
  }

  @Post('attachments/:category/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 1 } }))
  attachmentUpload(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Param('category') category: string, @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined, @Body('reference') reference?: string) {
    return this.service.attachmentUpload(user.id, companyId, category, file, reference);
  }

  @Put('attachments/:category/order')
  attachmentReorder(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Param('category') category: string, @Body() body: unknown) {
    return this.service.attachmentReorder(user.id, companyId, category, body);
  }

  @Get('attachments/export/pdf')
  async attachmentPdf(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Res() response: Response) {
    this.sendFile(response, await this.service.attachmentPdf(user.id, companyId), 'application/pdf', '高新附件汇总.pdf');
  }

  @Get('attachments/export/zip')
  async attachmentZip(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Res() response: Response) {
    this.sendFile(response, await this.service.materialZip(user.id, companyId), 'application/zip', '高新申报材料-草稿.zip');
  }

  @Get('attachments/:id/file')
  async attachmentFile(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Param('id') id: string, @Res() response: Response) {
    const { item, buffer } = await this.service.attachmentFile(user.id, companyId, id);
    this.sendFile(response, buffer, item.mime || 'application/pdf', item.name, true);
  }

  @Delete('attachments/:id')
  attachmentRemove(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Param('id') id: string) {
    return this.service.attachmentRemove(user.id, companyId, id);
  }

  private sendFile(response: Response, buffer: Buffer, type: string, filename: string, inline = false) {
    response.setHeader('Content-Type', type);
    response.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(filename)}`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(buffer);
  }

  @Get('tech-fields')
  fieldCatalog(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string) {
    return this.service.fieldCatalog(user.id, companyId);
  }

  @Post('tech-fields/recommend')
  recommendFields(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Body() body: unknown) {
    return this.service.recommendFields(user.id, companyId, body);
  }

  @Post('names/generate')
  generateNames(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Body() body: unknown) {
    return this.service.generateNames(user.id, companyId, body);
  }

  @Post('ip-allocation/preview')
  previewIpAllocation(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Body() body: unknown) {
    return this.service.previewIpAllocation(user.id, companyId, body);
  }

  @Post('ip-summary/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 3 } }))
  async importIpSummary(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined, @Res() response: Response) {
    try {
      const data = await this.service.importIpSummary(user.id, companyId, file);
      response.status(200).json({ code: 0, data, message: '导入成功' });
    } catch (error) {
      if (error instanceof BadRequestException) {
        const body = error.getResponse();
        // The shared exception filter only preserves message, not per-row errors.
        if (typeof body === 'object' && 'errors' in body) {
          response.status(400).json({ code: 400, data: null, ...body });
          return;
        }
      }
      throw error;
    }
  }

  @Post('ip-summary/recognize-pdfs')
  // Busboy emits partsLimit upon reaching the limit; allow the closing boundary after 10 files.
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 10 * 1024 * 1024, files: 10, fields: 0, parts: 11 } }))
  recognizeIpPdfs(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @UploadedFiles() files: IpPdfUpload[] | undefined) {
    return this.service.recognizeIpPdfs(user.id, companyId, files);
  }

  @Post('project-details/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 3 } }))
  async importProjectDetails(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined, @Res() response: Response) {
    try {
      const data = await this.service.importProjectDetails(user.id, companyId, file);
      response.status(200).json({ code: 0, data, message: '解析成功' });
    } catch (error) {
      if (error instanceof BadRequestException) {
        const body = error.getResponse();
        if (typeof body === 'object' && 'errors' in body) {
          response.status(400).json({ code: 400, data: null, ...body });
          return;
        }
      }
      throw error;
    }
  }

  @Post('project-details/export')
  async exportProjectDetails(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Body() body: unknown, @Res() response: Response) {
    const { buffer, filename } = await this.service.exportProjectDetails(user.id, companyId, body);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    response.send(buffer);
  }

  @Post('ip-summary/export')
  async exportIpSummary(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Body() body: unknown, @Res() response: Response) {
    const { buffer, filename } = await this.service.exportIpSummary(user.id, companyId, body);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    response.send(buffer);
  }

  @Get('ip-summary/template')
  async ipSummaryTemplate(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Res() response: Response) {
    const { buffer, filename } = await this.service.ipSummaryTemplate(user.id, companyId);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    response.send(buffer);
  }

  @Get('export')
  async export(@CurrentUserInfo() user: CurrentUser, @Param('companyId') companyId: string, @Res() response: Response) {
    const { buffer, filename } = await this.service.export(user.id, companyId);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    response.send(buffer);
  }
}
