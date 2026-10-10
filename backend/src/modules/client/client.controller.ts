import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Delete,
  Query,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request, Response } from 'express';
import { extname } from 'node:path';

import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { RequirePortals } from '../../common/decorators/require-portal.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { PortalGuard } from '../../common/guards/portal.guard';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  createUploadFileName,
  ensureUploadAreaDirectory,
  getUploadAllowedExtensions,
  isUploadExtensionAllowed,
  normalizeUploadFileOriginalName,
  resolveUploadArea,
} from '../../common/utils/upload.util';
import {
  BindCompanyDto,
  ClientDeclarationFlowActionDto,
  AdoptClientGaoxinDocumentPackageDto,
  ApproveClientAiDraftsDto,
  ClientProjectMaterialCheckDto,
  CreateClientIpRecognitionTaskDto,
  CreateClientProductServiceGenerationDto,
  CreateClientResearchAutoMatchDto,
  CreateClientResearchGenerationDto,
  CreateClientTransformationGenerationDto,
  SaveClientGaoxinBookDraftDto,
  SaveClientEnterpriseBasicProfileDto,
  SaveClientEnterpriseContactDto,
  SaveClientEnterpriseRecordDto,
  SaveClientEnterpriseShareholderDto,
  SwitchCurrentCompanyDto,
  UpdateClientAiDraftDto,
  UpdateClientEnterpriseProfileDto,
  UpdateClientMeDto,
} from './dto';
import { ClientService } from './client.service';
import { EnterpriseArchiveService } from './enterprise-archive.service';

type StoredUploadFile = {
  filename: string;
  mimetype?: string;
  originalname: string;
  path?: string;
  size: number;
};

const MATERIAL_UPLOAD_AREA = resolveUploadArea('enterprise', 'attachment');

function createMaterialUploadInterceptorOptions() {
  return {
    fileFilter: (
      _req: unknown,
      file: unknown,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const uploadFile = normalizeUploadFileOriginalName(file as StoredUploadFile);
      if (
        !isUploadExtensionAllowed(
          MATERIAL_UPLOAD_AREA,
          uploadFile.originalname ?? '',
        )
      ) {
        callback(
          new BadRequestException(
            `file extension is not allowed, supported: ${getUploadAllowedExtensions(
              MATERIAL_UPLOAD_AREA,
            ).join(', ')}`,
          ) as unknown as Error,
          false,
        );
        return;
      }

      callback(null, true);
    },
    storage: diskStorage({
      destination: (
        _req: unknown,
        _file: unknown,
        callback: (error: Error | null, value: string) => void,
      ) => {
        callback(null, ensureUploadAreaDirectory(MATERIAL_UPLOAD_AREA));
      },
      filename: (
        _req: unknown,
        file: unknown,
        callback: (error: Error | null, filename: string) => void,
      ) => {
        const uploadFile = file as StoredUploadFile;
        callback(null, createUploadFileName(uploadFile.originalname));
      },
    }),
  };
}

function createIpRecognitionUploadInterceptorOptions() {
  return {
    fileFilter: (
      _req: unknown,
      file: unknown,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const uploadFile = normalizeUploadFileOriginalName(file as StoredUploadFile);
      const extension = extname(uploadFile.originalname ?? '').toLowerCase();
      const mimeType = uploadFile.mimetype?.toLowerCase();
      const isPdf =
        extension === '.pdf' ||
        mimeType === 'application/pdf' ||
        mimeType === 'application/x-pdf';
      if (!isPdf) {
        callback(
          new BadRequestException('知识产权识别仅支持 PDF 文件') as unknown as Error,
          false,
        );
        return;
      }

      callback(null, true);
    },
    limits: {
      fileSize: 20 * 1024 * 1024,
      files: 20,
    },
    storage: diskStorage({
      destination: (
        _req: unknown,
        _file: unknown,
        callback: (error: Error | null, value: string) => void,
      ) => {
        callback(null, ensureUploadAreaDirectory(MATERIAL_UPLOAD_AREA));
      },
      filename: (
        _req: unknown,
        file: unknown,
        callback: (error: Error | null, filename: string) => void,
      ) => {
        const uploadFile = file as StoredUploadFile;
        callback(null, createUploadFileName(uploadFile.originalname));
      },
    }),
  };
}

function createEmployeeImportUploadInterceptorOptions() {
  const allowedExtensions = new Set(['.xls', '.xlsm', '.xlsx']);
  return {
    fileFilter: (
      _req: unknown,
      file: unknown,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const uploadFile = normalizeUploadFileOriginalName(file as StoredUploadFile);
      const extension = extname(uploadFile.originalname ?? '').toLowerCase();
      if (!allowedExtensions.has(extension)) {
        callback(
          new BadRequestException('员工花名册仅支持 Excel 文件（.xlsx、.xlsm、.xls）') as unknown as Error,
          false,
        );
        return;
      }

      callback(null, true);
    },
    limits: {
      fileSize: 20 * 1024 * 1024,
      files: 1,
    },
    storage: diskStorage({
      destination: (
        _req: unknown,
        _file: unknown,
        callback: (error: Error | null, value: string) => void,
      ) => {
        callback(null, ensureUploadAreaDirectory(MATERIAL_UPLOAD_AREA));
      },
      filename: (
        _req: unknown,
        file: unknown,
        callback: (error: Error | null, filename: string) => void,
      ) => {
        const uploadFile = file as StoredUploadFile;
        callback(null, createUploadFileName(uploadFile.originalname));
      },
    }),
  };
}

function createFinanceAiUploadInterceptorOptions() {
  const allowedExtensions = new Set(['.csv', '.jpg', '.jpeg', '.pdf', '.png', '.xls', '.xlsx']);
  return {
    fileFilter: (
      _req: unknown,
      file: unknown,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const uploadFile = normalizeUploadFileOriginalName(file as StoredUploadFile);
      const extension = extname(uploadFile.originalname ?? '').toLowerCase();
      if (!allowedExtensions.has(extension)) {
        callback(
          new BadRequestException('财税 AI 解析支持 PDF、图片、CSV 和 Excel 文件') as unknown as Error,
          false,
        );
        return;
      }

      callback(null, true);
    },
    limits: {
      fileSize: 30 * 1024 * 1024,
      files: 10,
    },
    storage: diskStorage({
      destination: (
        _req: unknown,
        _file: unknown,
        callback: (error: Error | null, value: string) => void,
      ) => {
        callback(null, ensureUploadAreaDirectory(MATERIAL_UPLOAD_AREA));
      },
      filename: (
        _req: unknown,
        file: unknown,
        callback: (error: Error | null, filename: string) => void,
      ) => {
        const uploadFile = file as StoredUploadFile;
        callback(null, createUploadFileName(uploadFile.originalname));
      },
    }),
  };
}

function createEnterpriseMediaUploadInterceptorOptions() {
  const allowedExtensions = new Set(['.jpeg', '.jpg', '.png', '.webp']);
  return {
    fileFilter: (
      _req: unknown,
      file: unknown,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const uploadFile = normalizeUploadFileOriginalName(file as StoredUploadFile);
      const extension = extname(uploadFile.originalname ?? '').toLowerCase();
      if (!allowedExtensions.has(extension)) {
        callback(
          new BadRequestException('Enterprise media supports JPG, PNG, and WebP images only') as unknown as Error,
          false,
        );
        return;
      }
      callback(null, true);
    },
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 10,
    },
    storage: diskStorage({
      destination: (
        _req: unknown,
        _file: unknown,
        callback: (error: Error | null, value: string) => void,
      ) => {
        callback(null, ensureUploadAreaDirectory(MATERIAL_UPLOAD_AREA));
      },
      filename: (
        _req: unknown,
        file: unknown,
        callback: (error: Error | null, filename: string) => void,
      ) => {
        const uploadFile = file as StoredUploadFile;
        callback(null, createUploadFileName(uploadFile.originalname));
      },
    }),
  };
}

@Controller('client')
@RequirePortals('client')
@UseGuards(AccessTokenGuard, PortalGuard)
export class ClientController {
  constructor(
    private readonly clientService: ClientService,
    private readonly enterpriseArchiveService: EnterpriseArchiveService,
  ) {}

  @Get('me')
  getMe(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.getClientMe(user.id);
  }

  @Put('me')
  updateMe(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: UpdateClientMeDto,
  ) {
    return this.clientService.updateClientMe(user.id, body);
  }

  @Get('companies')
  async getCompanies(@CurrentUserInfo() user: CurrentUser) {
    return this.enterpriseArchiveService.enrich(await this.clientService.getClientCompanies(user.id));
  }

  @Get('companies/current')
  getCurrentCompany(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.getCurrentClientCompany(user.id);
  }

  @Put('companies/current')
  switchCurrentCompany(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: SwitchCurrentCompanyDto,
  ) {
    return this.clientService.switchCurrentClientCompany(user, body);
  }

  @Post('companies/bind')
  bindCompany(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: BindCompanyDto,
  ) {
    return this.clientService.bindClientCompany(user.id, body, user.roles);
  }

  @Get('enterprise/profile')
  getEnterpriseProfile(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.getClientEnterpriseProfile(user.id);
  }

  @Put('enterprise/profile')
  updateEnterpriseProfile(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: UpdateClientEnterpriseProfileDto,
  ) {
    return this.clientService.updateClientEnterpriseProfile(user.id, body);
  }

  @Get('enterprise/basic-profile')
  getEnterpriseBasicProfile(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.getClientEnterpriseBasicProfile(user.id);
  }

  @Put('enterprise/basic-profile')
  updateEnterpriseBasicProfile(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: SaveClientEnterpriseBasicProfileDto,
  ) {
    return this.clientService.updateClientEnterpriseBasicProfile(user.id, body);
  }

  @Get('enterprise/basic-profile/shareholders')
  listEnterpriseShareholders(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.listClientEnterpriseShareholders(user.id);
  }

  @Post('enterprise/basic-profile/shareholders')
  createEnterpriseShareholder(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: SaveClientEnterpriseShareholderDto,
  ) {
    return this.clientService.createClientEnterpriseShareholder(user.id, body);
  }

  @Put('enterprise/basic-profile/shareholders/:id')
  updateEnterpriseShareholder(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: SaveClientEnterpriseShareholderDto,
  ) {
    return this.clientService.updateClientEnterpriseShareholder(
      user.id,
      id,
      body,
    );
  }

  @Delete('enterprise/basic-profile/shareholders/:id')
  deleteEnterpriseShareholder(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.deleteClientEnterpriseShareholder(user.id, id);
  }

  @Get('enterprise/contacts')
  getEnterpriseContacts(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.getClientEnterpriseContacts(user.id);
  }

  @Post('enterprise/contacts')
  createEnterpriseContact(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: SaveClientEnterpriseContactDto,
  ) {
    return this.clientService.createClientEnterpriseContact(user.id, body);
  }

  @Put('enterprise/contacts/:id')
  updateEnterpriseContact(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: SaveClientEnterpriseContactDto,
  ) {
    return this.clientService.updateClientEnterpriseContact(user.id, id, body);
  }

  @Get('material-templates')
  getMaterialTemplates() {
    return this.clientService.getClientMaterialTemplates();
  }

  @Get('material-templates/:id/download')
  async downloadMaterialTemplate(
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.clientService.downloadClientMaterialTemplate(id, response);
  }

  @Post('materials/upload')
  @UseInterceptors(
    FileInterceptor('file', createMaterialUploadInterceptorOptions()),
  )
  uploadMaterial(
    @CurrentUserInfo() user: CurrentUser,
    @UploadedFile() file: StoredUploadFile | undefined,
    @Body('templateId') templateId: string,
    @Req() request: Request,
  ) {
    if (!file) {
      throw new BadRequestException('file upload failed');
    }

    return this.clientService.uploadClientMaterial(
      user.id,
      templateId,
      file,
      request,
    );
  }

  @Get('materials')
  getMaterials(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.getClientMaterials(user.id);
  }

  @Get('enterprise/materials/:id/preview')
  async previewEnterpriseMaterial(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    await this.clientService.previewClientEnterpriseMaterial(
      user.id,
      id,
      response,
    );
  }

  @Get('materials/:id/errors')
  getMaterialErrors(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.getClientMaterialErrors(user.id, id);
  }

  @Get('enterprise/employees/stats')
  getEnterpriseEmployeeStats(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.getClientEmployeeStats(user.id);
  }

  @Get('enterprise/employees/template')
  async downloadEnterpriseEmployeeTemplate(@Res() response: Response): Promise<void> {
    await this.clientService.downloadClientEmployeeTemplate(response);
  }

  @Get('enterprise/employees/export')
  async exportEnterpriseEmployees(
    @CurrentUserInfo() user: CurrentUser,
    @Res() response: Response,
  ): Promise<void> {
    await this.clientService.exportClientEmployees(user.id, response);
  }

  @Post('enterprise/employees/import/preview')
  @UseInterceptors(
    FilesInterceptor('file', 1, createEmployeeImportUploadInterceptorOptions()),
  )
  previewEnterpriseEmployeeImport(
    @CurrentUserInfo() user: CurrentUser,
    @UploadedFiles() files: StoredUploadFile[] | undefined,
  ) {
    const file = files?.[0];
    if (!file) {
      throw new BadRequestException('未收到员工花名册文件，请重新选择 Excel 文件上传');
    }

    return this.clientService.previewClientEmployeeImport(user.id, file);
  }

  @Post('enterprise/employees/import/confirm')
  confirmEnterpriseEmployeeImport(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: { materialId?: string; skippedKeys?: string[] },
  ) {
    return this.clientService.confirmClientEmployeeImport(user.id, body);
  }

  @Get('policies')
  listPolicies(
    @CurrentUserInfo() user: CurrentUser,
    @Query() query: Record<string, string | string[] | undefined>,
    @Req() request: Request,
  ) {
    return this.clientService.listClientPolicies(user.id, query, request);
  }

  @Get('policies/:id')
  getPolicyDetail(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.clientService.getClientPolicyDetail(user.id, id, request);
  }

  @Get('projects')
  listProjects(
    @CurrentUserInfo() user: CurrentUser,
    @Query() query: Record<string, string | string[] | undefined>,
    @Req() request: Request,
  ) {
    return this.clientService.listClientDeclareProjects(user.id, query, request);
  }

  @Get('projects/:id')
  getProjectDetail(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Query('regionId') regionId?: string,
  ) {
    return this.clientService.getClientDeclareProjectDetail(user.id, id, regionId);
  }

  @Get('projects/:id/readiness')
  getProjectReadiness(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Query('regionId') regionId?: string,
  ) {
    return this.clientService.getClientProjectReadiness(user.id, id, regionId);
  }

  @Get('projects/:id/material-readiness')
  getProjectMaterialReadiness(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Query('regionId') regionId?: string,
  ) {
    return this.clientService.getClientProjectMaterialReadiness(user.id, id, regionId);
  }

  @Get('projects/:id/gaoxin-score')
  getProjectGaoxinScore(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Query('regionId') regionId?: string,
  ) {
    return this.clientService.getClientProjectGaoxinScore(user.id, id, regionId);
  }

  @Get('projects/:id/scheme-score')
  getProjectSchemeScore(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Query('regionId') regionId?: string,
  ) {
    return this.clientService.getClientProjectSchemeScore(user.id, id, regionId);
  }

  @Get('projects/:id/ai-diagnosis')
  getProjectGaoxinAiDiagnosis(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Query('regionId') regionId?: string,
  ) {
    return this.clientService.getClientProjectGaoxinAiDiagnosis(user.id, id, regionId);
  }

  @Post('projects/:id/material-check')
  createProjectMaterialCheck(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: ClientProjectMaterialCheckDto,
  ) {
    return this.clientService.createClientProjectMaterialCheck(user.id, id, body);
  }

  @Post('projects/:id/declarations')
  createDeclarationDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: ClientProjectMaterialCheckDto,
  ) {
    return this.clientService.createClientDeclarationDraft(user.id, id, body.regionId);
  }

  @Get('declarations')
  listDeclarations(
    @CurrentUserInfo() user: CurrentUser,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    return this.clientService.listClientDeclarations(user.id, query);
  }

  @Get('declarations/stats')
  getDeclarationStats(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.getClientDeclarationStats(user.id);
  }

  @Get('declarations/:id')
  getDeclarationDetail(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.getClientDeclarationDetail(user.id, id);
  }

  @Get('declarations/:id/material-readiness')
  getDeclarationMaterialReadiness(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.getClientDeclarationMaterialReadiness(user.id, id);
  }

  @Get('declarations/:id/gaoxin-score')
  getDeclarationGaoxinScore(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.getClientDeclarationGaoxinScore(user.id, id);
  }

  @Post('declarations/:id/sync-scheme')
  syncDeclarationScheme(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.syncClientDeclarationScheme(user.id, id);
  }

  @Post('declarations/:id/flow/advance')
  advanceDeclarationFlow(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: ClientDeclarationFlowActionDto,
  ) {
    return this.clientService.advanceClientDeclarationFlow(user.id, id, body);
  }

  @Get('declarations/:id/scheme-score')
  getDeclarationSchemeScore(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.getClientDeclarationSchemeScore(user.id, id);
  }

  @Get('declarations/:id/ai-diagnosis')
  getDeclarationGaoxinAiDiagnosis(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.getClientDeclarationGaoxinAiDiagnosis(user.id, id);
  }

  @Get('declarations/:id/gaoxin-book')
  getDeclarationGaoxinBookDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.getClientDeclarationGaoxinBookDraft(user.id, id);
  }

  @Put('declarations/:id/gaoxin-book')
  saveDeclarationGaoxinBookDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: SaveClientGaoxinBookDraftDto,
  ) {
    return this.clientService.saveClientDeclarationGaoxinBookDraft(user.id, id, body);
  }

  @Get('declarations/:id/gaoxin-export-readiness')
  getDeclarationGaoxinExportReadiness(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.getClientDeclarationGaoxinExportReadiness(user.id, id);
  }

  @Get('declarations/:id/gaoxin-export-package')
  async downloadDeclarationGaoxinExportPackage(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.clientService.downloadClientDeclarationGaoxinExportPackage(
      user.id,
      id,
      response,
    );
  }

  @Post('declarations/:id/material-check')
  createDeclarationMaterialCheck(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.createClientDeclarationMaterialCheck(user.id, id);
  }

  @Get('enterprise-profile/stats')
  getEnterpriseProfileStats(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.getClientEnterpriseProfileStats(user.id);
  }

  @Post('enterprise-profile/stats/recalculate')
  recalculateEnterpriseProfileStats(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.recalculateClientEnterpriseProfileStats(user.id);
  }

  @Post('enterprise/property/ip-recognition/uploads')
  @UseInterceptors(
    FilesInterceptor('files', 20, createIpRecognitionUploadInterceptorOptions()),
  )
  uploadIpRecognitionPdfs(
    @CurrentUserInfo() user: CurrentUser,
    @UploadedFiles() files: StoredUploadFile[] | undefined,
    @Req() request: Request,
  ) {
    if (!files?.length) {
      throw new BadRequestException('请上传至少一个 PDF 文件');
    }

    return this.clientService.uploadClientIpRecognitionPdfs(
      user.id,
      files,
      request,
    );
  }

  @Get('enterprise/property/ip-recognition/tasks/:id')
  getIpRecognitionTask(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.getClientIpRecognitionTask(user.id, id);
  }

  @Get('enterprise/property/ai-tasks')
  listPropertyAiTasks(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.listClientPropertyAiTasks(user.id);
  }

  @Get('enterprise/property/evidence-summary')
  getPropertyEvidenceSummary(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.getClientPropertyEvidenceSummary(user.id);
  }

  @Post('enterprise/property/technology-fields/classify')
  classifyPropertyTechnologyFields(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.classifyClientPropertyTechnologyFields(user.id);
  }

  @Get('enterprise/property/ai-readiness')
  getPropertyAiReadiness(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.getClientPropertyAiReadiness(user.id);
  }

  @Post('enterprise/property/evidence-relations/repair')
  repairPropertyEvidenceRelations(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.repairClientPropertyEvidenceRelations(user.id);
  }

  @Post('enterprise/property/ip-recognition/tasks')
  createIpRecognitionTask(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: CreateClientIpRecognitionTaskDto,
    @Req() request: Request,
  ) {
    return this.clientService.createClientIpRecognitionTask(
      user.id,
      body,
      request,
    );
  }

  @Get('enterprise/property/ip-recognition/drafts')
  listIpRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Req() request: Request,
  ) {
    return this.clientService.listClientIpRecognitionDrafts(user.id, request);
  }

  @Patch('enterprise/property/ip-recognition/drafts/:id')
  patchIpRecognitionDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: UpdateClientAiDraftDto,
    @Req() request: Request,
  ) {
    return this.clientService.updateClientIpRecognitionDraft(
      user.id,
      id,
      body,
      request,
    );
  }

  @Post('enterprise/finance/ai-parse/uploads')
  @UseInterceptors(
    FilesInterceptor('files', 10, createFinanceAiUploadInterceptorOptions()),
  )
  uploadFinanceAiParseFiles(
    @CurrentUserInfo() user: CurrentUser,
    @UploadedFiles() files: StoredUploadFile[] | undefined,
    @Req() request: Request,
  ) {
    if (!files?.length) {
      throw new BadRequestException('请上传至少一个财税文件');
    }

    return this.clientService.uploadClientFinanceAiParseFiles(
      user.id,
      files,
      request,
    );
  }

  @Get('enterprise/finance/ai-parse/drafts')
  listFinanceAiParseDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Req() request: Request,
  ) {
    return this.clientService.listClientFinanceAiParseDrafts(user.id, request);
  }

  @Post('enterprise/finance/ai-parse/approve')
  approveFinanceAiParseDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: ApproveClientAiDraftsDto,
  ) {
    return this.clientService.approveClientFinanceAiParseDrafts(user.id, body);
  }

  @Post('enterprise/finance/ai-parse/reject')
  rejectFinanceAiParseDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: ApproveClientAiDraftsDto,
  ) {
    return this.clientService.rejectClientFinanceAiParseDrafts(user.id, body);
  }

  @Delete('enterprise/finance/ai-parse/drafts/:id')
  deleteFinanceAiParseDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.deleteClientFinanceAiParseDraft(user.id, id);
  }

  @Put('enterprise/property/ip-recognition/drafts/:id')
  updateIpRecognitionDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: UpdateClientAiDraftDto,
    @Req() request: Request,
  ) {
    return this.clientService.updateClientIpRecognitionDraft(
      user.id,
      id,
      body,
      request,
    );
  }

  @Post('enterprise/property/ip-recognition/approve')
  approveIpRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: ApproveClientAiDraftsDto,
  ) {
    return this.clientService.approveClientIpRecognitionDrafts(user.id, body);
  }

  @Post('enterprise/property/ip-recognition/reject')
  rejectIpRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: ApproveClientAiDraftsDto,
  ) {
    return this.clientService.rejectClientIpRecognitionDrafts(user.id, body);
  }

  @Delete('enterprise/property/ip-recognition/drafts/:id')
  deleteIpRecognitionDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.deleteClientIpRecognitionDraft(user.id, id);
  }

  @Post('enterprise/property/ip-recognition/retry')
  retryIpRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: ApproveClientAiDraftsDto,
  ) {
    return this.clientService.retryClientIpRecognitionDrafts(user.id, body);
  }

  @Get('enterprise/property/transformation/generation/sources')
  listTransformationGenerationSources(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.listClientTransformationGenerationSources(user.id);
  }

  @Post('enterprise/property/transformation/generation/tasks')
  createTransformationGenerationTask(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: CreateClientTransformationGenerationDto,
  ) {
    return this.clientService.createClientTransformationGenerationTask(
      user.id,
      body,
    );
  }

  @Get('enterprise/property/transformation/generation/tasks/:id')
  getTransformationGenerationTask(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.getClientPropertyGenerationTask(
      user.id,
      id,
      'transformation_generation',
    );
  }

  @Get('enterprise/property/transformation/generation/drafts')
  listTransformationGenerationDrafts(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.listClientTransformationGenerationDrafts(user.id);
  }

  @Patch('enterprise/property/transformation/generation/drafts/:id')
  patchTransformationGenerationDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: UpdateClientAiDraftDto,
  ) {
    return this.clientService.updateClientTransformationGenerationDraft(
      user.id,
      id,
      body,
    );
  }

  @Put('enterprise/property/transformation/generation/drafts/:id')
  updateTransformationGenerationDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: UpdateClientAiDraftDto,
  ) {
    return this.clientService.updateClientTransformationGenerationDraft(
      user.id,
      id,
      body,
    );
  }

  @Post('enterprise/property/transformation/generation/approve')
  approveTransformationGenerationDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: ApproveClientAiDraftsDto,
  ) {
    return this.clientService.approveClientTransformationGenerationDrafts(
      user.id,
      body,
    );
  }

  @Post('enterprise/property/transformation/generation/reject')
  rejectTransformationGenerationDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: ApproveClientAiDraftsDto,
  ) {
    return this.clientService.rejectClientTransformationGenerationDrafts(
      user.id,
      body,
    );
  }

  @Delete('enterprise/property/transformation/generation/drafts/:id')
  deleteTransformationGenerationDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.deleteClientTransformationGenerationDraft(
      user.id,
      id,
    );
  }

  @Get('enterprise/property/research/generation/sources')
  listResearchGenerationSources(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.listClientResearchGenerationSources(user.id);
  }

  @Post('enterprise/property/research/generation/tasks')
  createResearchGenerationTask(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: CreateClientResearchGenerationDto,
  ) {
    return this.clientService.createClientResearchGenerationTask(user.id, body);
  }

  @Post('enterprise/property/research/generation/auto-match/tasks')
  createResearchAutoMatchTask(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: CreateClientResearchAutoMatchDto,
  ) {
    return this.clientService.createClientResearchAutoMatchTask(user.id, body);
  }

  @Post('enterprise/property/research/generation/auto-match/preview')
  previewResearchAutoMatch(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: CreateClientResearchAutoMatchDto,
  ) {
    return this.clientService.previewClientResearchAutoMatch(user.id, body);
  }

  @Get('enterprise/property/research/generation/tasks/:id')
  getResearchGenerationTask(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.getClientPropertyGenerationTask(
      user.id,
      id,
      'research_generation',
    );
  }

  @Get('enterprise/property/research/generation/drafts')
  listResearchGenerationDrafts(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.listClientResearchGenerationDrafts(user.id);
  }

  @Patch('enterprise/property/research/generation/drafts/:id')
  patchResearchGenerationDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: UpdateClientAiDraftDto,
  ) {
    return this.clientService.updateClientResearchGenerationDraft(
      user.id,
      id,
      body,
    );
  }

  @Put('enterprise/property/research/generation/drafts/:id')
  updateResearchGenerationDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: UpdateClientAiDraftDto,
  ) {
    return this.clientService.updateClientResearchGenerationDraft(
      user.id,
      id,
      body,
    );
  }

  @Post('enterprise/property/research/generation/approve')
  approveResearchGenerationDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: ApproveClientAiDraftsDto,
  ) {
    return this.clientService.approveClientResearchGenerationDrafts(
      user.id,
      body,
    );
  }

  @Post('enterprise/property/research/generation/reject')
  rejectResearchGenerationDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: ApproveClientAiDraftsDto,
  ) {
    return this.clientService.rejectClientResearchGenerationDrafts(
      user.id,
      body,
    );
  }

  @Post('enterprise/property/research/generation/drafts/batch-delete')
  deleteResearchGenerationDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: ApproveClientAiDraftsDto,
  ) {
    return this.clientService.deleteClientResearchGenerationDrafts(
      user.id,
      body,
    );
  }

  @Delete('enterprise/property/research/generation/drafts/:id')
  deleteResearchGenerationDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.deleteClientResearchGenerationDraft(user.id, id);
  }

  @Get('enterprise/property/product-service/generation/sources')
  listProductServiceGenerationSources(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.listClientProductServiceGenerationSources(user.id);
  }

  @Post('enterprise/property/product-service/generation/tasks')
  createProductServiceGenerationTask(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: CreateClientProductServiceGenerationDto,
  ) {
    return this.clientService.createClientProductServiceGenerationTask(
      user.id,
      body,
    );
  }

  @Get('enterprise/property/product-service/generation/tasks/:id')
  getProductServiceGenerationTask(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.getClientPropertyGenerationTask(
      user.id,
      id,
      'product_service_generation',
    );
  }

  @Get('enterprise/property/product-service/generation/drafts')
  listProductServiceGenerationDrafts(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.listClientProductServiceGenerationDrafts(user.id);
  }

  @Patch('enterprise/property/product-service/generation/drafts/:id')
  patchProductServiceGenerationDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: UpdateClientAiDraftDto,
  ) {
    return this.clientService.updateClientProductServiceGenerationDraft(
      user.id,
      id,
      body,
    );
  }

  @Put('enterprise/property/product-service/generation/drafts/:id')
  updateProductServiceGenerationDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: UpdateClientAiDraftDto,
  ) {
    return this.clientService.updateClientProductServiceGenerationDraft(
      user.id,
      id,
      body,
    );
  }

  @Post('enterprise/property/product-service/generation/drafts/:id/duplicate')
  duplicateProductServiceGenerationDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.duplicateClientProductServiceGenerationDraft(
      user.id,
      id,
    );
  }

  @Delete('enterprise/property/product-service/generation/drafts/:id')
  deleteProductServiceGenerationDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.deleteClientProductServiceGenerationDraft(
      user.id,
      id,
    );
  }

  @Post('enterprise/property/product-service/generation/approve')
  approveProductServiceGenerationDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: ApproveClientAiDraftsDto,
  ) {
    return this.clientService.approveClientProductServiceGenerationDrafts(
      user.id,
      body,
    );
  }

  @Post('enterprise/property/product-service/generation/reject')
  rejectProductServiceGenerationDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: ApproveClientAiDraftsDto,
  ) {
    return this.clientService.rejectClientProductServiceGenerationDrafts(
      user.id,
      body,
    );
  }

  @Get('enterprise/documents/gaoxin-package')
  getGaoxinDocumentPackage(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.getClientGaoxinDocumentPackage(user.id);
  }

  @Post('enterprise/documents/gaoxin-package/adopt')
  adoptGaoxinDocumentPackage(
    @CurrentUserInfo() user: CurrentUser,
    @Body() body: AdoptClientGaoxinDocumentPackageDto,
  ) {
    return this.clientService.adoptClientGaoxinDocumentPackage(user.id, body);
  }

  @Get('enterprise-records/:moduleKey/:tabKey')
  listEnterpriseRecords(
    @CurrentUserInfo() user: CurrentUser,
    @Param('moduleKey') moduleKey: string,
    @Param('tabKey') tabKey: string,
  ) {
    return this.clientService.listClientEnterpriseRecords(user.id, moduleKey, tabKey);
  }

  @Get('enterprise-records/:moduleKey/:tabKey/:id/file')
  async previewEnterpriseRecordFile(
    @CurrentUserInfo() user: CurrentUser,
    @Param('moduleKey') moduleKey: string,
    @Param('tabKey') tabKey: string,
    @Param('id') id: string,
    @Query('path') filePath: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.clientService.previewClientEnterpriseRecordFile(
      user.id,
      moduleKey,
      tabKey,
      id,
      filePath,
      response,
    );
  }

  @Post('enterprise-media/uploads')
  @UseInterceptors(
    FilesInterceptor('files', 10, createEnterpriseMediaUploadInterceptorOptions()),
  )
  uploadEnterpriseMedia(
    @CurrentUserInfo() user: CurrentUser,
    @UploadedFiles() files: StoredUploadFile[] | undefined,
  ) {
    if (!files?.length) {
      throw new BadRequestException('Please upload at least one image');
    }
    return this.clientService.uploadClientEnterpriseMedia(user.id, files);
  }

  @Get('enterprise-media/:type/:id/file')
  async previewEnterpriseMediaFile(
    @CurrentUserInfo() user: CurrentUser,
    @Param('type') type: string,
    @Param('id') id: string,
    @Query('path') filePath: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.clientService.previewClientEnterpriseMediaFile(
      user.id,
      type,
      id,
      filePath,
      response,
    );
  }

  @Post('enterprise-records/:moduleKey/:tabKey')
  createEnterpriseRecord(
    @CurrentUserInfo() user: CurrentUser,
    @Param('moduleKey') moduleKey: string,
    @Param('tabKey') tabKey: string,
    @Body() body: SaveClientEnterpriseRecordDto,
  ) {
    return this.clientService.createClientEnterpriseRecord(
      user.id,
      moduleKey,
      tabKey,
      body,
    );
  }

  @Put('enterprise-records/:moduleKey/:tabKey/:id')
  updateEnterpriseRecord(
    @CurrentUserInfo() user: CurrentUser,
    @Param('moduleKey') moduleKey: string,
    @Param('tabKey') tabKey: string,
    @Param('id') id: string,
    @Body() body: SaveClientEnterpriseRecordDto,
  ) {
    return this.clientService.updateClientEnterpriseRecord(
      user.id,
      moduleKey,
      tabKey,
      id,
      body,
    );
  }

  @Delete('enterprise-records/:moduleKey/:tabKey/:id')
  deleteEnterpriseRecord(
    @CurrentUserInfo() user: CurrentUser,
    @Param('moduleKey') moduleKey: string,
    @Param('tabKey') tabKey: string,
    @Param('id') id: string,
  ) {
    return this.clientService.deleteClientEnterpriseRecord(
      user.id,
      moduleKey,
      tabKey,
      id,
    );
  }

  @Delete('enterprise-records/:moduleKey/:tabKey')
  clearEnterpriseRecordsByTab(
    @CurrentUserInfo() user: CurrentUser,
    @Param('moduleKey') moduleKey: string,
    @Param('tabKey') tabKey: string,
  ) {
    return this.clientService.clearClientEnterpriseRecordsByTab(
      user.id,
      moduleKey,
      tabKey,
    );
  }

  @Delete('enterprise-records/:moduleKey')
  clearEnterpriseRecordsByModule(
    @CurrentUserInfo() user: CurrentUser,
    @Param('moduleKey') moduleKey: string,
  ) {
    return this.clientService.clearClientEnterpriseRecordsByModule(
      user.id,
      moduleKey,
    );
  }

  @Get('enterprise-media/certificates')
  listEnterpriseCertificates(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.listClientEnterpriseRecords(
      user.id,
      'media',
      'certificates',
    );
  }

  @Post('enterprise-media/certificates')
  createEnterpriseCertificate(
    @CurrentUserInfo() user: CurrentUser,
    @Body() data: Record<string, unknown>,
  ) {
    return this.clientService.createClientEnterpriseRecord(user.id, 'media', 'certificates', {
      data,
    });
  }

  @Delete('enterprise-media/certificates/:id')
  deleteEnterpriseCertificate(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.deleteClientEnterpriseRecord(
      user.id,
      'media',
      'certificates',
      id,
    );
  }

  @Post('enterprise-media/certificates/batch-delete')
  async batchDeleteEnterpriseCertificates(
    @CurrentUserInfo() user: CurrentUser,
    @Body('ids') ids: Array<number | string> = [],
  ) {
    await Promise.all(
      ids.map((id) =>
        this.clientService.deleteClientEnterpriseRecord(
          user.id,
          'media',
          'certificates',
          String(id),
        ),
      ),
    );
    return { success: true };
  }

  @Get('enterprise-media/photos')
  listEnterprisePhotos(@CurrentUserInfo() user: CurrentUser) {
    return this.clientService.listClientEnterpriseRecords(user.id, 'media', 'photos');
  }

  @Get('enterprise-media/photos/stats')
  async getEnterprisePhotoStats(@CurrentUserInfo() user: CurrentUser) {
    const result = await this.clientService.listClientEnterpriseRecords(
      user.id,
      'media',
      'photos',
    );
    const countByStatus = (status: number) =>
      result.items.filter(
        (item) => Number((item as Record<string, unknown>).photo_status) === status,
      ).length;
    return {
      equipment: countByStatus(3),
      product: countByStatus(4),
      site: countByStatus(1),
      total: result.total,
      training: countByStatus(2),
    };
  }

  @Post('enterprise-media/photos')
  createEnterprisePhoto(
    @CurrentUserInfo() user: CurrentUser,
    @Body() data: Record<string, unknown>,
  ) {
    return this.clientService.createClientEnterpriseRecord(user.id, 'media', 'photos', {
      data,
    });
  }

  @Delete('enterprise-media/photos/:id')
  deleteEnterprisePhoto(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.deleteClientEnterpriseRecord(user.id, 'media', 'photos', id);
  }

  @Get('enterprise/accounts')
  async listEnterpriseAccounts(@CurrentUserInfo() user: CurrentUser) {
    const result = await this.clientService.listClientEnterpriseRecords(
      user.id,
      'account',
      'accounts',
    );
    return result.items;
  }

  @Get('enterprise/accounts/:id')
  async getEnterpriseAccount(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    const result = await this.clientService.listClientEnterpriseRecords(
      user.id,
      'account',
      'accounts',
    );
    return result.items.find((item) => String(item.id) === String(id)) ?? null;
  }

  @Post('enterprise/accounts')
  createEnterpriseAccount(
    @CurrentUserInfo() user: CurrentUser,
    @Body() data: Record<string, unknown>,
  ) {
    return this.clientService.createClientEnterpriseRecord(
      user.id,
      'account',
      'accounts',
      { data },
    );
  }

  @Put('enterprise/accounts/:id')
  updateEnterpriseAccount(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
    @Body() data: Record<string, unknown>,
  ) {
    return this.clientService.updateClientEnterpriseRecord(
      user.id,
      'account',
      'accounts',
      id,
      { data },
    );
  }

  @Delete('enterprise/accounts/:id')
  deleteEnterpriseAccount(
    @CurrentUserInfo() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.clientService.deleteClientEnterpriseRecord(
      user.id,
      'account',
      'accounts',
      id,
    );
  }
}
