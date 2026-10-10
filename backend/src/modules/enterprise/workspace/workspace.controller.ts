import {
  BadRequestException,
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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { RequirePermissions } from '../../../common/decorators/require-access.decorator';
import { RequirePortals } from '../../../common/decorators/require-portal.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { PortalGuard } from '../../../common/guards/portal.guard';
import type { CurrentUser } from '../../../common/interfaces/current-user.interface';
import {
  createUploadFileName,
  ensureUploadAreaDirectory,
  isUploadExtensionAllowed,
  normalizeUploadFileOriginalName,
  resolveUploadArea,
} from '../../../common/utils/upload.util';
import type { EnterpriseInput } from '../profile/dto';
import {
  EnterpriseWorkspaceContactDto,
  EnterpriseWorkspaceDeclarationReviewDto,
  EnterpriseWorkspaceEmployeeDto,
  EnterpriseWorkspaceFinancialRecordDto,
  EnterpriseWorkspaceTaxAuditDto,
  EnterpriseWorkspaceIntellectualPropertyDto,
  EnterpriseWorkspaceResearchProjectDto,
  EnterpriseWorkspaceProductServiceDto,
  EnterpriseWorkspaceTransformationDto,
  EnterpriseWorkspaceAccountDto,
  EnterpriseWorkspaceCertificateDto,
  EnterpriseWorkspaceBatchDeleteDto,
  EnterpriseWorkspaceContractDto,
  EnterpriseWorkspaceDocumentDto,
  EnterpriseWorkspaceAdoptGaoxinDocumentPackageDto,
  EnterpriseWorkspaceInvoiceDto,
  EnterpriseWorkspaceDeclarationDraftDto,
  EnterpriseWorkspaceBasicProfileDto,
} from './dto';
import { EnterpriseWorkspacePhotoDto } from './photo.dto';
import { EnterpriseWorkspaceService } from './workspace.service';

type StoredUploadFile = {
  filename: string;
  originalname: string;
  path?: string;
  size: number;
};

const EMPLOYEE_IMPORT_UPLOAD_AREA = resolveUploadArea('enterprise', 'attachment');

function createFinanceAiUploadInterceptorOptions() {
  const allowedExtensions = new Set(['.csv', '.jpg', '.jpeg', '.pdf', '.png', '.xls', '.xlsx']);
  return {
    fileFilter: (_request: unknown, file: unknown, callback: (error: Error | null, acceptFile: boolean) => void) => {
      const uploadFile = normalizeUploadFileOriginalName(file as StoredUploadFile);
      if (!allowedExtensions.has(extname(uploadFile.originalname ?? '').toLowerCase())) {
        callback(new BadRequestException('财税 AI 解析支持 PDF、图片、CSV 和 Excel 文件') as unknown as Error, false);
        return;
      }
      callback(null, true);
    },
    limits: { fileSize: 30 * 1024 * 1024, files: 10 },
    storage: diskStorage({
      destination: (_request: unknown, _file: unknown, callback: (error: Error | null, value: string) => void) => callback(null, ensureUploadAreaDirectory(EMPLOYEE_IMPORT_UPLOAD_AREA)),
      filename: (_request: unknown, file: unknown, callback: (error: Error | null, filename: string) => void) => callback(null, createUploadFileName((file as StoredUploadFile).originalname)),
    }),
  };
}

function createIpRecognitionUploadInterceptorOptions() {
  return {
    fileFilter: (_request: unknown, file: unknown, callback: (error: Error | null, acceptFile: boolean) => void) => {
      const uploadFile = normalizeUploadFileOriginalName(file as StoredUploadFile);
      if (extname(uploadFile.originalname ?? '').toLowerCase() !== '.pdf') {
        callback(new BadRequestException('知识产权识别仅支持 PDF 文件') as unknown as Error, false);
        return;
      }
      callback(null, true);
    },
    limits: { fileSize: 20 * 1024 * 1024, files: 20 },
    storage: diskStorage({
      destination: (_request: unknown, _file: unknown, callback: (error: Error | null, value: string) => void) => callback(null, ensureUploadAreaDirectory(EMPLOYEE_IMPORT_UPLOAD_AREA)),
      filename: (_request: unknown, file: unknown, callback: (error: Error | null, filename: string) => void) => callback(null, createUploadFileName((file as StoredUploadFile).originalname)),
    }),
  };
}

function createContractRecognitionUploadInterceptorOptions(label = '合同') {
  return {
    fileFilter: (_request: unknown, file: unknown, callback: (error: Error | null, acceptFile: boolean) => void) => {
      const uploadFile = normalizeUploadFileOriginalName(file as StoredUploadFile);
      if (extname(uploadFile.originalname ?? '').toLowerCase() !== '.pdf') {
        callback(new BadRequestException(`${label}识别仅支持 PDF 文件`) as unknown as Error, false);
        return;
      }
      callback(null, true);
    },
    limits: { fileSize: 20 * 1024 * 1024, files: 10 },
    storage: diskStorage({
      destination: (_request: unknown, _file: unknown, callback: (error: Error | null, value: string) => void) => callback(null, ensureUploadAreaDirectory(EMPLOYEE_IMPORT_UPLOAD_AREA)),
      filename: (_request: unknown, file: unknown, callback: (error: Error | null, filename: string) => void) => callback(null, createUploadFileName((file as StoredUploadFile).originalname)),
    }),
  };
}

function createEmployeeImportUploadInterceptorOptions() {
  const allowedExtensions = new Set(['.pdf', '.xls', '.xlsm', '.xlsx']);
  return {
    fileFilter: (
      _request: unknown,
      file: unknown,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const uploadFile = normalizeUploadFileOriginalName(file as StoredUploadFile);
      const extension = extname(uploadFile.originalname ?? '').toLowerCase();
      if (!allowedExtensions.has(extension)) {
        callback(
          new BadRequestException('员工名册仅支持 Excel 或社保 PDF 文件') as unknown as Error,
          false,
        );
        return;
      }
      callback(null, true);
    },
    limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    storage: diskStorage({
      destination: (
        _request: unknown,
        _file: unknown,
        callback: (error: Error | null, value: string) => void,
      ) => callback(null, ensureUploadAreaDirectory(EMPLOYEE_IMPORT_UPLOAD_AREA)),
      filename: (
        _request: unknown,
        file: unknown,
        callback: (error: Error | null, filename: string) => void,
      ) => callback(null, createUploadFileName((file as StoredUploadFile).originalname)),
    }),
  };
}

function createEmployeeAttachmentUploadInterceptorOptions() {
  return {
    fileFilter: (_request: unknown, file: unknown, callback: (error: Error | null, acceptFile: boolean) => void) => {
      const uploadFile = normalizeUploadFileOriginalName(file as StoredUploadFile);
      if (!isUploadExtensionAllowed(EMPLOYEE_IMPORT_UPLOAD_AREA, uploadFile.originalname ?? '')) {
        callback(new BadRequestException('员工附件格式不受支持') as unknown as Error, false);
        return;
      }
      callback(null, true);
    },
    limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    storage: diskStorage({
      destination: (request: unknown, _file: unknown, callback: (error: Error | null, value: string) => void) => {
        const enterpriseId = String((request as { params?: Record<string, string> }).params?.enterpriseId ?? '').trim();
        if (!/^\d+$/u.test(enterpriseId)) {
          callback(new BadRequestException('企业参数无效') as unknown as Error, '');
          return;
        }
        const directory = join(ensureUploadAreaDirectory(EMPLOYEE_IMPORT_UPLOAD_AREA), enterpriseId);
        mkdirSync(directory, { recursive: true });
        callback(null, directory);
      },
      filename: (
        _request: unknown,
        file: unknown,
        callback: (error: Error | null, filename: string) => void,
      ) => callback(null, createUploadFileName((file as StoredUploadFile).originalname)),
    }),
  };
}

function createMaterialTemplateUploadInterceptorOptions() {
  return {
    fileFilter: (_request: unknown, file: unknown, callback: (error: Error | null, acceptFile: boolean) => void) => {
      normalizeUploadFileOriginalName(file as StoredUploadFile);
      callback(null, true);
    },
    limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    storage: diskStorage({
      destination: (
        _request: unknown,
        _file: unknown,
        callback: (error: Error | null, value: string) => void,
      ) => callback(null, ensureUploadAreaDirectory(EMPLOYEE_IMPORT_UPLOAD_AREA)),
      filename: (
        _request: unknown,
        file: unknown,
        callback: (error: Error | null, filename: string) => void,
      ) => callback(null, createUploadFileName((file as StoredUploadFile).originalname)),
    }),
  };
}

@Controller('enterprise-workspace')
@RequirePortals('admin')
@UseGuards(AccessTokenGuard, PortalGuard, PermissionGuard)
export class EnterpriseWorkspaceController {
  constructor(
    private readonly enterpriseWorkspaceService: EnterpriseWorkspaceService,
  ) {}

  @Get('overview')
  @RequirePermissions('Enterprise:Profile:List')
  getOverview(@CurrentUserInfo() currentUser: CurrentUser) {
    return this.enterpriseWorkspaceService.getOverview(currentUser);
  }

  @Get('materials')
  @RequirePermissions('Enterprise:Profile:List')
  getMaterialLedger(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    return this.enterpriseWorkspaceService.getMaterialLedger(query, currentUser);
  }

  @Get('material-templates')
  @RequirePermissions('Enterprise:Profile:List')
  getMaterialTemplates() {
    return this.enterpriseWorkspaceService.getMaterialTemplates();
  }

  @Get('material-templates/:templateId/download')
  @RequirePermissions('Enterprise:Profile:List')
  async downloadMaterialTemplate(
    @Param('templateId') templateId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.enterpriseWorkspaceService.downloadMaterialTemplate(
      templateId,
      response,
    );
  }

  @Get('enterprises/:enterpriseId/materials')
  @RequirePermissions('Enterprise:Profile:List')
  getEnterpriseMaterials(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
  ) {
    return this.enterpriseWorkspaceService.getEnterpriseMaterials(enterpriseId, user);
  }

  @Get('enterprises/:enterpriseId/materials/:materialId/preview')
  @RequirePermissions('Enterprise:Profile:List')
  async previewEnterpriseMaterial(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('materialId') materialId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.enterpriseWorkspaceService.previewEnterpriseMaterial(
      enterpriseId,
      materialId,
      user,
      response,
    );
  }

  @Get('enterprises/:enterpriseId/materials/:materialId/errors')
  @RequirePermissions('Enterprise:Profile:List')
  getEnterpriseMaterialErrors(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('materialId') materialId: string,
  ) {
    return this.enterpriseWorkspaceService.getEnterpriseMaterialErrors(
      enterpriseId,
      materialId,
      user,
    );
  }

  @Get('enterprises/:enterpriseId/attachments/:attachmentType/:recordId/preview')
  @RequirePermissions('Enterprise:Profile:List')
  async previewEnterpriseAttachment(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('attachmentType') attachmentType: 'certificate' | 'contract' | 'document' | 'employee' | 'intellectual_property' | 'photo' | 'tax-audit',
    @Param('recordId') recordId: string,
    @Query('path') filePath: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.enterpriseWorkspaceService.previewEnterpriseAttachment(
      enterpriseId,
      attachmentType,
      recordId,
      filePath,
      user,
      response,
    );
  }

  @Post('enterprises/:enterpriseId/materials/upload')
  @RequirePermissions('Enterprise:Profile:Edit')
  @UseInterceptors(
    FileInterceptor('file', createMaterialTemplateUploadInterceptorOptions()),
  )
  uploadEnterpriseMaterial(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body('templateId') templateId: string,
    @UploadedFile() file: StoredUploadFile | undefined,
  ) {
    if (!file) throw new BadRequestException('file upload failed');
    return this.enterpriseWorkspaceService.uploadEnterpriseMaterial(
      enterpriseId,
      templateId,
      file,
      user,
    );
  }

  @Get('declarations')
  @RequirePermissions('Enterprise:Profile:List')
  listDeclarationLedger(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    return this.enterpriseWorkspaceService.listDeclarationLedger(
      query,
      currentUser,
    );
  }

  @Get('enterprises/:id/summary')
  @RequirePermissions('Enterprise:Profile:List')
  getSummary(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('id') enterpriseId: string,
  ) {
    return this.enterpriseWorkspaceService.getSummary(
      enterpriseId,
      currentUser,
    );
  }

  @Get('enterprises/:enterpriseId/evidence-chain')
  @RequirePermissions('Enterprise:Profile:List')
  getEvidenceChain(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
  ) {
    return this.enterpriseWorkspaceService.getEvidenceChain(
      enterpriseId,
      currentUser,
    );
  }

  @Get('enterprises/:enterpriseId/todos')
  @RequirePermissions('Enterprise:Profile:List')
  listTodos(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string) {
    return this.enterpriseWorkspaceService.listTodos(enterpriseId, user);
  }

  @Get('enterprises/:enterpriseId/declarations')
  @RequirePermissions('Enterprise:Profile:List')
  listDeclarations(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string) {
    return this.enterpriseWorkspaceService.listDeclarations(enterpriseId, user);
  }

  @Get('enterprises/:enterpriseId/declarations/:declarationId')
  @RequirePermissions('Enterprise:Profile:List')
  getDeclarationDetail(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('declarationId') declarationId: string) {
    return this.enterpriseWorkspaceService.getDeclarationDetail(enterpriseId, declarationId, user);
  }

  @Get('enterprises/:enterpriseId/candidate-projects')
  @RequirePermissions('Enterprise:Profile:List')
  listCandidateProjects(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string) {
    return this.enterpriseWorkspaceService.listCandidateProjects(enterpriseId, user);
  }

  @Post('enterprises/:enterpriseId/declarations')
  @RequirePermissions('Enterprise:Profile:Edit')
  createDeclarationDraft(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: EnterpriseWorkspaceDeclarationDraftDto) {
    return this.enterpriseWorkspaceService.createDeclarationDraft(enterpriseId, body, user);
  }

  @Post('enterprises/:enterpriseId/declarations/:declarationId/submit')
  @RequirePermissions('Enterprise:Profile:Edit')
  submitDeclarationForReview(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('declarationId') declarationId: string) {
    return this.enterpriseWorkspaceService.submitDeclarationForReview(enterpriseId, declarationId, user);
  }

  @Get('enterprises/:enterpriseId/profile')
  @RequirePermissions('Enterprise:Profile:List')
  getProfile(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
  ) {
    return this.enterpriseWorkspaceService.getProfile(enterpriseId, currentUser);
  }

  @Post('enterprises/:enterpriseId/declarations/:declarationId/review')
  @RequirePermissions('Enterprise:Profile:Edit')
  @OperationLog({ module: '企业工作台-申报审核', action: '处理企业申报审核' })
  reviewDeclaration(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('declarationId') declarationId: string,
    @Body() body: EnterpriseWorkspaceDeclarationReviewDto,
  ) {
    return this.enterpriseWorkspaceService.reviewDeclaration(
      enterpriseId,
      declarationId,
      body,
      user,
    );
  }

  @Put('enterprises/:enterpriseId/profile')
  @RequirePermissions('Enterprise:Profile:Edit')
  updateProfile(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: EnterpriseInput,
  ) {
    return this.enterpriseWorkspaceService.updateProfile(
      enterpriseId,
      body,
      currentUser,
    );
  }

  @Get('enterprises/:enterpriseId/basic-profile')
  @RequirePermissions('Enterprise:Profile:List')
  getBasicProfile(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
  ) {
    return this.enterpriseWorkspaceService.getBasicProfile(
      enterpriseId,
      currentUser,
    );
  }

  @Put('enterprises/:enterpriseId/basic-profile')
  @RequirePermissions('Enterprise:Profile:Edit')
  updateBasicProfile(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: EnterpriseWorkspaceBasicProfileDto,
  ) {
    return this.enterpriseWorkspaceService.updateBasicProfile(
      enterpriseId,
      body,
      currentUser,
    );
  }

  @Get('enterprises/:enterpriseId/contacts')
  @RequirePermissions('Enterprise:Profile:List')
  listContacts(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
  ) {
    return this.enterpriseWorkspaceService.listContacts(enterpriseId, currentUser);
  }

  @Post('enterprises/:enterpriseId/contacts')
  @RequirePermissions('Enterprise:Profile:Edit')
  createContact(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: EnterpriseWorkspaceContactDto,
  ) {
    return this.enterpriseWorkspaceService.createContact(
      enterpriseId,
      body,
      currentUser,
    );
  }

  @Put('enterprises/:enterpriseId/contacts/:contactId')
  @RequirePermissions('Enterprise:Profile:Edit')
  updateContact(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('contactId') contactId: string,
    @Body() body: EnterpriseWorkspaceContactDto,
  ) {
    return this.enterpriseWorkspaceService.updateContact(
      enterpriseId,
      contactId,
      body,
      currentUser,
    );
  }

  @Delete('enterprises/:enterpriseId/contacts/:contactId')
  @RequirePermissions('Enterprise:Profile:Edit')
  removeContact(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.enterpriseWorkspaceService.removeContact(
      enterpriseId,
      contactId,
      currentUser,
    );
  }

  @Get('enterprises/:enterpriseId/finance/financial')
  @RequirePermissions('Enterprise:Profile:List')
  listFinancialRecords(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.enterpriseWorkspaceService.listFinancialRecords(
      enterpriseId,
      currentUser,
      includeDeleted === 'true',
    );
  }

  @Get('enterprises/:enterpriseId/finance/tax-audits')
  @RequirePermissions('Enterprise:Profile:List')
  listTaxAudits(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.enterpriseWorkspaceService.listTaxAudits(enterpriseId, currentUser, includeDeleted === 'true');
  }

  @Post('enterprises/:enterpriseId/finance/ai-parse/uploads')
  @RequirePermissions('Enterprise:Profile:Edit')
  @UseInterceptors(FilesInterceptor('files', 10, createFinanceAiUploadInterceptorOptions()))
  uploadFinanceAiParseFiles(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @UploadedFiles() files: StoredUploadFile[] | undefined,
  ) {
    if (!files?.length) throw new BadRequestException('请上传至少一个财税文件');
    return this.enterpriseWorkspaceService.uploadFinanceAiParseFiles(enterpriseId, user, files);
  }

  @Get('enterprises/:enterpriseId/finance/ai-parse/drafts')
  @RequirePermissions('Enterprise:Profile:List')
  listFinanceAiParseDrafts(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string) {
    return this.enterpriseWorkspaceService.listFinanceAiParseDrafts(enterpriseId, user);
  }

  @Post('enterprises/:enterpriseId/finance/ai-parse/approve')
  @RequirePermissions('Enterprise:Profile:Edit')
  approveFinanceAiParseDrafts(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: { ids?: string[] }) {
    return this.enterpriseWorkspaceService.approveFinanceAiParseDrafts(enterpriseId, user, body.ids ?? []);
  }

  @Put('enterprises/:enterpriseId/finance/ai-parse/drafts/:draftId')
  @RequirePermissions('Enterprise:Profile:Edit')
  updateFinanceAiParseDraft(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('draftId') draftId: string, @Body() body: { data?: Record<string, unknown> }) {
    return this.enterpriseWorkspaceService.updateFinanceAiParseDraft(enterpriseId, draftId, body, user);
  }

  @Post('enterprises/:enterpriseId/finance/ai-parse/reject')
  @RequirePermissions('Enterprise:Profile:Edit')
  rejectFinanceAiParseDrafts(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: { ids?: string[] }) {
    return this.enterpriseWorkspaceService.rejectFinanceAiParseDrafts(enterpriseId, user, body.ids ?? []);
  }

  @Post('enterprises/:enterpriseId/finance/ai-parse/retry')
  @RequirePermissions('Enterprise:Profile:Edit')
  retryFinanceAiParseDrafts(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: { ids?: string[] }) {
    return this.enterpriseWorkspaceService.retryFinanceAiParseDrafts(enterpriseId, user, body.ids ?? []);
  }

  @Delete('enterprises/:enterpriseId/finance/ai-parse/drafts/:draftId')
  @RequirePermissions('Enterprise:Profile:Edit')
  removeFinanceAiParseDraft(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('draftId') draftId: string) {
    return this.enterpriseWorkspaceService.removeFinanceAiParseDraft(enterpriseId, draftId, user);
  }

  @Get('enterprises/:enterpriseId/employees')
  @RequirePermissions('Enterprise:Profile:List')
  listEmployees(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    return this.enterpriseWorkspaceService.listEmployees(
      enterpriseId,
      user,
      query,
    );
  }

  @Get('enterprises/:enterpriseId/employees/template')
  @RequirePermissions('Enterprise:Profile:List')
  downloadEmployeeImportTemplate(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Res() response: Response,
  ) {
    return this.enterpriseWorkspaceService.downloadEmployeeImportTemplate(
      enterpriseId,
      user,
      response,
    );
  }

  @Get('enterprises/:enterpriseId/employees/export')
  @RequirePermissions('Enterprise:Profile:List')
  exportEmployees(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Res() response: Response,
  ) {
    return this.enterpriseWorkspaceService.exportEmployees(
      enterpriseId,
      user,
      response,
    );
  }

  @Post('enterprises/:enterpriseId/employees/import/preview')
  @RequirePermissions('Enterprise:Profile:Edit')
  @UseInterceptors(
    FilesInterceptor('file', 1, createEmployeeImportUploadInterceptorOptions()),
  )
  previewEmployeeImport(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @UploadedFiles() files: StoredUploadFile[] | undefined,
  ) {
    const file = files?.[0];
    if (!file) {
      throw new BadRequestException('未收到员工名册文件，请重新选择 Excel 或社保 PDF 文件上传');
    }
    return this.enterpriseWorkspaceService.previewEmployeeImport(
      enterpriseId,
      file,
      user,
    );
  }

  @Post('enterprises/:enterpriseId/employees/import/confirm')
  @RequirePermissions('Enterprise:Profile:Edit')
  @OperationLog({ module: '企业工作台-员工', action: '确认导入员工名册' })
  confirmEmployeeImport(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { materialId?: string; skippedKeys?: string[] },
  ) {
    return this.enterpriseWorkspaceService.confirmEmployeeImport(
      enterpriseId,
      body,
      user,
    );
  }

  @Post('enterprises/:enterpriseId/employees/attachments')
  @RequirePermissions('Enterprise:Profile:Edit')
  @UseInterceptors(FileInterceptor('file', createEmployeeAttachmentUploadInterceptorOptions()))
  uploadEmployeeAttachment(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @UploadedFile() file: StoredUploadFile | undefined,
  ) {
    return this.enterpriseWorkspaceService.uploadEmployeeAttachment(enterpriseId, file, user);
  }

  @Post('enterprises/:enterpriseId/archive-attachments')
  @RequirePermissions('Enterprise:Profile:Edit')
  @UseInterceptors(FileInterceptor('file', createEmployeeAttachmentUploadInterceptorOptions()))
  uploadArchiveAttachment(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @UploadedFile() file: StoredUploadFile | undefined,
  ) {
    return this.enterpriseWorkspaceService.uploadEmployeeAttachment(enterpriseId, file, user);
  }

  @Post('enterprises/:enterpriseId/archive-records/contracts/recognition/uploads')
  @RequirePermissions('Enterprise:Profile:Edit')
  @UseInterceptors(FilesInterceptor('files', 10, createContractRecognitionUploadInterceptorOptions()))
  uploadContractRecognitionPdfs(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @UploadedFiles() files: StoredUploadFile[] | undefined,
  ) {
    if (!files?.length) throw new BadRequestException('请至少上传一个合同 PDF 文件');
    return this.enterpriseWorkspaceService.uploadContractRecognitionPdfs(enterpriseId, user, files);
  }

  @Get('enterprises/:enterpriseId/archive-records/contracts/recognition/drafts')
  @RequirePermissions('Enterprise:Profile:List')
  listContractRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
  ) {
    return this.enterpriseWorkspaceService.listContractRecognitionDrafts(enterpriseId, user);
  }

  @Post('enterprises/:enterpriseId/archive-records/contracts/recognition/approve')
  @RequirePermissions('Enterprise:Profile:Edit')
  approveContractRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { ids?: Array<number | string> },
  ) {
    return this.enterpriseWorkspaceService.approveContractRecognitionDrafts(
      enterpriseId,
      user,
      body.ids ?? [],
    );
  }

  @Put('enterprises/:enterpriseId/archive-records/contracts/recognition/drafts/:draftId')
  @RequirePermissions('Enterprise:Profile:Edit')
  updateContractRecognitionDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('draftId') draftId: string,
    @Body() body: { data?: Record<string, unknown> },
  ) {
    return this.enterpriseWorkspaceService.updateContractRecognitionDraft(
      enterpriseId,
      draftId,
      body,
      user,
    );
  }

  @Post('enterprises/:enterpriseId/archive-records/contracts/recognition/reject')
  @RequirePermissions('Enterprise:Profile:Edit')
  rejectContractRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { ids?: Array<number | string> },
  ) {
    return this.enterpriseWorkspaceService.rejectContractRecognitionDrafts(
      enterpriseId,
      user,
      body.ids ?? [],
    );
  }

  @Post('enterprises/:enterpriseId/archive-records/contracts/recognition/retry')
  @RequirePermissions('Enterprise:Profile:Edit')
  retryContractRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { ids?: Array<number | string> },
  ) {
    return this.enterpriseWorkspaceService.retryContractRecognitionDrafts(
      enterpriseId,
      user,
      body.ids ?? [],
    );
  }

  @Delete('enterprises/:enterpriseId/archive-records/contracts/recognition/drafts/:draftId')
  @RequirePermissions('Enterprise:Profile:Edit')
  removeContractRecognitionDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('draftId') draftId: string,
  ) {
    return this.enterpriseWorkspaceService.removeContractRecognitionDraft(
      enterpriseId,
      draftId,
      user,
    );
  }

  @Post('enterprises/:enterpriseId/archive-records/invoices/recognition/uploads')
  @RequirePermissions('Enterprise:Profile:Edit')
  @UseInterceptors(FilesInterceptor('files', 10, createContractRecognitionUploadInterceptorOptions('发票')))
  uploadInvoiceRecognitionPdfs(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @UploadedFiles() files: StoredUploadFile[] | undefined,
  ) {
    if (!files?.length) throw new BadRequestException('请至少上传一个发票 PDF 文件');
    return this.enterpriseWorkspaceService.uploadInvoiceRecognitionPdfs(enterpriseId, user, files);
  }

  @Get('enterprises/:enterpriseId/archive-records/invoices/recognition/drafts')
  @RequirePermissions('Enterprise:Profile:List')
  listInvoiceRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
  ) {
    return this.enterpriseWorkspaceService.listInvoiceRecognitionDrafts(enterpriseId, user);
  }

  @Post('enterprises/:enterpriseId/archive-records/invoices/recognition/approve')
  @RequirePermissions('Enterprise:Profile:Edit')
  approveInvoiceRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { ids?: Array<number | string> },
  ) {
    return this.enterpriseWorkspaceService.approveInvoiceRecognitionDrafts(
      enterpriseId,
      user,
      body.ids ?? [],
    );
  }

  @Put('enterprises/:enterpriseId/archive-records/invoices/recognition/drafts/:draftId')
  @RequirePermissions('Enterprise:Profile:Edit')
  updateInvoiceRecognitionDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('draftId') draftId: string,
    @Body() body: { data?: Record<string, unknown> },
  ) {
    return this.enterpriseWorkspaceService.updateInvoiceRecognitionDraft(
      enterpriseId,
      draftId,
      body,
      user,
    );
  }

  @Post('enterprises/:enterpriseId/archive-records/invoices/recognition/reject')
  @RequirePermissions('Enterprise:Profile:Edit')
  rejectInvoiceRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { ids?: Array<number | string> },
  ) {
    return this.enterpriseWorkspaceService.rejectInvoiceRecognitionDrafts(
      enterpriseId,
      user,
      body.ids ?? [],
    );
  }

  @Post('enterprises/:enterpriseId/archive-records/invoices/recognition/retry')
  @RequirePermissions('Enterprise:Profile:Edit')
  retryInvoiceRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { ids?: Array<number | string> },
  ) {
    return this.enterpriseWorkspaceService.retryInvoiceRecognitionDrafts(
      enterpriseId,
      user,
      body.ids ?? [],
    );
  }

  @Delete('enterprises/:enterpriseId/archive-records/invoices/recognition/drafts/:draftId')
  @RequirePermissions('Enterprise:Profile:Edit')
  removeInvoiceRecognitionDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('draftId') draftId: string,
  ) {
    return this.enterpriseWorkspaceService.removeInvoiceRecognitionDraft(
      enterpriseId,
      draftId,
      user,
    );
  }

  @Post('enterprises/:enterpriseId/employees')
  @RequirePermissions('Enterprise:Profile:Edit')
  @OperationLog({ module: '企业工作台-员工', action: '新增员工' })
  createEmployee(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: EnterpriseWorkspaceEmployeeDto,
  ) {
    return this.enterpriseWorkspaceService.createEmployee(enterpriseId, body, user);
  }

  @Put('enterprises/:enterpriseId/employees/:employeeId')
  @RequirePermissions('Enterprise:Profile:Edit')
  @OperationLog({ module: '企业工作台-员工', action: '编辑员工' })
  updateEmployee(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('employeeId') employeeId: string,
    @Body() body: EnterpriseWorkspaceEmployeeDto,
  ) {
    return this.enterpriseWorkspaceService.updateEmployee(
      enterpriseId,
      employeeId,
      body,
      user,
    );
  }

  @Delete('enterprises/:enterpriseId/employees/:employeeId')
  @RequirePermissions('Enterprise:Profile:Edit')
  @OperationLog({ module: '企业工作台-员工', action: '删除员工' })
  removeEmployee(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.enterpriseWorkspaceService.removeEmployee(
      enterpriseId,
      employeeId,
      user,
    );
  }

  @Get('enterprises/:enterpriseId/properties/intellectual-properties')
  @RequirePermissions('Enterprise:Profile:List')
  listIntellectualProperties(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string) {
    return this.enterpriseWorkspaceService.listIntellectualProperties(enterpriseId, user);
  }

  @Post('enterprises/:enterpriseId/properties/ip-recognition/uploads')
  @RequirePermissions('Enterprise:Profile:Edit')
  @UseInterceptors(FilesInterceptor('files', 20, createIpRecognitionUploadInterceptorOptions()))
  uploadIpRecognitionPdfs(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @UploadedFiles() files: StoredUploadFile[] | undefined,
  ) {
    if (!files?.length) throw new BadRequestException('请至少上传一个 PDF 文件');
    return this.enterpriseWorkspaceService.uploadIpRecognitionPdfs(enterpriseId, user, files);
  }

  @Get('enterprises/:enterpriseId/properties/ip-recognition/drafts')
  @RequirePermissions('Enterprise:Profile:List')
  listIpRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
  ) {
    return this.enterpriseWorkspaceService.listIpRecognitionDrafts(enterpriseId, user);
  }

  @Get('enterprises/:enterpriseId/ai-tasks')
  @RequirePermissions('Enterprise:Profile:List')
  listAiTasks(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
  ) {
    return this.enterpriseWorkspaceService.listAiTasks(enterpriseId, user);
  }

  @Delete('enterprises/:enterpriseId/ai-tasks/:taskId')
  @RequirePermissions('Enterprise:Profile:Edit')
  @OperationLog({ module: '企业工作台-AI任务', action: '删除失败任务' })
  removeAiTask(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.enterpriseWorkspaceService.removeAiTask(enterpriseId, taskId, user);
  }

  @Post('enterprises/:enterpriseId/properties/ip-recognition/approve')
  @RequirePermissions('Enterprise:Profile:Edit')
  approveIpRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { ids?: Array<number | string> },
  ) {
    return this.enterpriseWorkspaceService.approveIpRecognitionDrafts(
      enterpriseId,
      user,
      body.ids ?? [],
    );
  }

  @Put('enterprises/:enterpriseId/properties/ip-recognition/drafts/:draftId')
  @RequirePermissions('Enterprise:Profile:Edit')
  updateIpRecognitionDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('draftId') draftId: string,
    @Body() body: { data?: Record<string, unknown> },
  ) {
    return this.enterpriseWorkspaceService.updateIpRecognitionDraft(
      enterpriseId,
      draftId,
      body,
      user,
    );
  }

  @Post('enterprises/:enterpriseId/properties/ip-recognition/reject')
  @RequirePermissions('Enterprise:Profile:Edit')
  rejectIpRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { ids?: Array<number | string> },
  ) {
    return this.enterpriseWorkspaceService.rejectIpRecognitionDrafts(
      enterpriseId,
      user,
      body.ids ?? [],
    );
  }

  @Post('enterprises/:enterpriseId/properties/ip-recognition/retry')
  @RequirePermissions('Enterprise:Profile:Edit')
  retryIpRecognitionDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { ids?: Array<number | string> },
  ) {
    return this.enterpriseWorkspaceService.retryIpRecognitionDrafts(
      enterpriseId,
      user,
      body.ids ?? [],
    );
  }

  @Delete('enterprises/:enterpriseId/properties/ip-recognition/drafts/:draftId')
  @RequirePermissions('Enterprise:Profile:Edit')
  removeIpRecognitionDraft(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('draftId') draftId: string,
  ) {
    return this.enterpriseWorkspaceService.removeIpRecognitionDraft(
      enterpriseId,
      draftId,
      user,
    );
  }

  @Post('enterprises/:enterpriseId/properties/transformations/generation/tasks')
  @RequirePermissions('Enterprise:Profile:Edit')
  createTransformationGenerationTask(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { businessMode?: 'auto' | 'mixed' | 'product' | 'service'; ipIds?: string[]; targetCount?: number },
  ) {
    return this.enterpriseWorkspaceService.createTransformationGenerationTask(
      enterpriseId,
      user,
      body,
    );
  }

  @Get('enterprises/:enterpriseId/properties/transformations/generation/drafts')
  @RequirePermissions('Enterprise:Profile:List')
  listTransformationGenerationDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
  ) {
    return this.enterpriseWorkspaceService.listTransformationGenerationDrafts(
      enterpriseId,
      user,
    );
  }

  @Post('enterprises/:enterpriseId/properties/transformations/generation/approve')
  @RequirePermissions('Enterprise:Profile:Edit')
  approveTransformationGenerationDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { ids?: Array<number | string> },
  ) {
    return this.enterpriseWorkspaceService.approveTransformationGenerationDrafts(
      enterpriseId,
      user,
      body.ids ?? [],
    );
  }

  @Post('enterprises/:enterpriseId/properties/research/generation/auto-match/tasks')
  @RequirePermissions('Enterprise:Profile:Edit')
  createResearchAutoMatchTask(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { ipIds?: string[]; targetCount?: number },
  ) {
    return this.enterpriseWorkspaceService.createResearchAutoMatchTask(
      enterpriseId,
      user,
      body,
    );
  }

  @Get('enterprises/:enterpriseId/properties/research/generation/drafts')
  @RequirePermissions('Enterprise:Profile:List')
  listResearchGenerationDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
  ) {
    return this.enterpriseWorkspaceService.listResearchGenerationDrafts(
      enterpriseId,
      user,
    );
  }

  @Post('enterprises/:enterpriseId/properties/research/generation/approve')
  @RequirePermissions('Enterprise:Profile:Edit')
  approveResearchGenerationDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { ids?: Array<number | string> },
  ) {
    return this.enterpriseWorkspaceService.approveResearchGenerationDrafts(
      enterpriseId,
      user,
      body.ids ?? [],
    );
  }

  @Post('enterprises/:enterpriseId/properties/research/generation/drafts/batch-delete')
  @RequirePermissions('Enterprise:Profile:Edit')
  deleteResearchGenerationDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: EnterpriseWorkspaceBatchDeleteDto,
  ) {
    return this.enterpriseWorkspaceService.deleteResearchGenerationDrafts(
      enterpriseId,
      user,
      body.ids,
    );
  }

  @Post('enterprises/:enterpriseId/properties/product-services/generation/tasks')
  @RequirePermissions('Enterprise:Profile:Edit')
  createProductServiceGenerationTask(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { businessMode?: 'auto' | 'mixed' | 'product' | 'service'; includeExisting?: boolean; rdIds?: string[]; targetCount?: number },
  ) {
    return this.enterpriseWorkspaceService.createProductServiceGenerationTask(
      enterpriseId,
      user,
      body,
    );
  }

  @Get('enterprises/:enterpriseId/properties/product-services/generation/drafts')
  @RequirePermissions('Enterprise:Profile:List')
  listProductServiceGenerationDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
  ) {
    return this.enterpriseWorkspaceService.listProductServiceGenerationDrafts(
      enterpriseId,
      user,
    );
  }

  @Post('enterprises/:enterpriseId/properties/product-services/generation/approve')
  @RequirePermissions('Enterprise:Profile:Edit')
  approveProductServiceGenerationDrafts(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Body() body: { ids?: Array<number | string> },
  ) {
    return this.enterpriseWorkspaceService.approveProductServiceGenerationDrafts(
      enterpriseId,
      user,
      body.ids ?? [],
    );
  }

  @Post('enterprises/:enterpriseId/properties/intellectual-properties')
  @RequirePermissions('Enterprise:Profile:Edit')
  createIntellectualProperty(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: EnterpriseWorkspaceIntellectualPropertyDto) {
    return this.enterpriseWorkspaceService.createIntellectualProperty(enterpriseId, body, user);
  }

  @Post('enterprises/:enterpriseId/properties/clear-all')
  @RequirePermissions('Enterprise:Profile:Edit')
  clearPropertyResearchData(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
  ) {
    return this.enterpriseWorkspaceService.clearPropertyResearchData(enterpriseId, user);
  }

  @Get('enterprises/:enterpriseId/properties/intellectual-properties/:propertyId/source-file')
  @RequirePermissions('Enterprise:Profile:List')
  async previewIntellectualPropertySourceFile(
    @CurrentUserInfo() user: CurrentUser,
    @Param('enterpriseId') enterpriseId: string,
    @Param('propertyId') propertyId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.enterpriseWorkspaceService.previewIntellectualPropertySourceFile(
      enterpriseId,
      propertyId,
      user,
      response,
    );
  }

  @Put('enterprises/:enterpriseId/properties/intellectual-properties/:propertyId')
  @RequirePermissions('Enterprise:Profile:Edit')
  updateIntellectualProperty(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('propertyId') propertyId: string, @Body() body: EnterpriseWorkspaceIntellectualPropertyDto) {
    return this.enterpriseWorkspaceService.updateIntellectualProperty(enterpriseId, propertyId, body, user);
  }

  @Delete('enterprises/:enterpriseId/properties/intellectual-properties/:propertyId')
  @RequirePermissions('Enterprise:Profile:Edit')
  removeIntellectualProperty(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('propertyId') propertyId: string) {
    return this.enterpriseWorkspaceService.removeIntellectualProperty(enterpriseId, propertyId, user);
  }

  @Get('enterprises/:enterpriseId/properties/research-projects')
  @RequirePermissions('Enterprise:Profile:List')
  listResearchProjects(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string) { return this.enterpriseWorkspaceService.listResearchProjects(enterpriseId, user); }
  @Post('enterprises/:enterpriseId/properties/research-projects')
  @RequirePermissions('Enterprise:Profile:Edit')
  createResearchProject(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: EnterpriseWorkspaceResearchProjectDto) { return this.enterpriseWorkspaceService.createResearchProject(enterpriseId, body, user); }
  @Put('enterprises/:enterpriseId/properties/research-projects/:propertyId')
  @RequirePermissions('Enterprise:Profile:Edit')
  updateResearchProject(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('propertyId') propertyId: string, @Body() body: EnterpriseWorkspaceResearchProjectDto) { return this.enterpriseWorkspaceService.updateResearchProject(enterpriseId, propertyId, body, user); }
  @Delete('enterprises/:enterpriseId/properties/research-projects/:propertyId')
  @RequirePermissions('Enterprise:Profile:Edit')
  removeResearchProject(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('propertyId') propertyId: string) { return this.enterpriseWorkspaceService.removeResearchProject(enterpriseId, propertyId, user); }
  @Get('enterprises/:enterpriseId/properties/product-services') @RequirePermissions('Enterprise:Profile:List') listProductServices(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string) { return this.enterpriseWorkspaceService.listProductServices(enterpriseId, user); }
  @Post('enterprises/:enterpriseId/properties/product-services') @RequirePermissions('Enterprise:Profile:Edit') createProductService(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: EnterpriseWorkspaceProductServiceDto) { return this.enterpriseWorkspaceService.createProductService(enterpriseId, body, user); }
  @Put('enterprises/:enterpriseId/properties/product-services/:propertyId') @RequirePermissions('Enterprise:Profile:Edit') updateProductService(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('propertyId') propertyId: string, @Body() body: EnterpriseWorkspaceProductServiceDto) { return this.enterpriseWorkspaceService.updateProductService(enterpriseId, propertyId, body, user); }
  @Delete('enterprises/:enterpriseId/properties/product-services/:propertyId') @RequirePermissions('Enterprise:Profile:Edit') removeProductService(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('propertyId') propertyId: string) { return this.enterpriseWorkspaceService.removeProductService(enterpriseId, propertyId, user); }
  @Get('enterprises/:enterpriseId/properties/transformations') @RequirePermissions('Enterprise:Profile:List') listTransformations(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string) { return this.enterpriseWorkspaceService.listTransformations(enterpriseId, user); }
  @Post('enterprises/:enterpriseId/properties/transformations') @RequirePermissions('Enterprise:Profile:Edit') createTransformation(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: EnterpriseWorkspaceTransformationDto) { return this.enterpriseWorkspaceService.createTransformation(enterpriseId, body, user); }
  @Put('enterprises/:enterpriseId/properties/transformations/:propertyId') @RequirePermissions('Enterprise:Profile:Edit') updateTransformation(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('propertyId') propertyId: string, @Body() body: EnterpriseWorkspaceTransformationDto) { return this.enterpriseWorkspaceService.updateTransformation(enterpriseId, propertyId, body, user); }
  @Delete('enterprises/:enterpriseId/properties/transformations/:propertyId') @RequirePermissions('Enterprise:Profile:Edit') removeTransformation(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('propertyId') propertyId: string) { return this.enterpriseWorkspaceService.removeTransformation(enterpriseId, propertyId, user); }

  @Get('enterprises/:enterpriseId/archive-records')
  @RequirePermissions('Enterprise:Profile:List')
  listArchiveRecords(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string) { return this.enterpriseWorkspaceService.listArchiveRecords(enterpriseId, user); }

  @Post('enterprises/:enterpriseId/archive-records/contracts') @RequirePermissions('Enterprise:Profile:Edit') createContract(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: EnterpriseWorkspaceContractDto) { return this.enterpriseWorkspaceService.createContract(enterpriseId, body, user); }
  @Put('enterprises/:enterpriseId/archive-records/contracts/:recordId') @RequirePermissions('Enterprise:Profile:Edit') updateContract(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string, @Body() body: EnterpriseWorkspaceContractDto) { return this.enterpriseWorkspaceService.updateContract(enterpriseId, recordId, body, user); }
  @Delete('enterprises/:enterpriseId/archive-records/contracts/:recordId') @RequirePermissions('Enterprise:Profile:Edit') removeContract(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string) { return this.enterpriseWorkspaceService.removeContract(enterpriseId, recordId, user); }

  @Post('enterprises/:enterpriseId/archive-records/invoices') @RequirePermissions('Enterprise:Profile:Edit') createInvoice(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: EnterpriseWorkspaceInvoiceDto) { return this.enterpriseWorkspaceService.createInvoice(enterpriseId, body, user); }
  @Put('enterprises/:enterpriseId/archive-records/invoices/:recordId') @RequirePermissions('Enterprise:Profile:Edit') updateInvoice(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string, @Body() body: EnterpriseWorkspaceInvoiceDto) { return this.enterpriseWorkspaceService.updateInvoice(enterpriseId, recordId, body, user); }
  @Delete('enterprises/:enterpriseId/archive-records/invoices/:recordId') @RequirePermissions('Enterprise:Profile:Edit') removeInvoice(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string) { return this.enterpriseWorkspaceService.removeInvoice(enterpriseId, recordId, user); }

  @Post('enterprises/:enterpriseId/archive-records/documents') @RequirePermissions('Enterprise:Profile:Edit') createDocument(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: EnterpriseWorkspaceDocumentDto) { return this.enterpriseWorkspaceService.createDocument(enterpriseId, body, user); }
  @Put('enterprises/:enterpriseId/archive-records/documents/:recordId') @RequirePermissions('Enterprise:Profile:Edit') updateDocument(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string, @Body() body: EnterpriseWorkspaceDocumentDto) { return this.enterpriseWorkspaceService.updateDocument(enterpriseId, recordId, body, user); }
  @Delete('enterprises/:enterpriseId/archive-records/documents/:recordId') @RequirePermissions('Enterprise:Profile:Edit') removeDocument(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string) { return this.enterpriseWorkspaceService.removeDocument(enterpriseId, recordId, user); }

  @Get('enterprises/:enterpriseId/archive-records/documents/gaoxin-package')
  @RequirePermissions('Enterprise:Profile:List')
  getGaoxinDocumentPackage(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string) { return this.enterpriseWorkspaceService.getGaoxinDocumentPackage(enterpriseId, user); }

  @Post('enterprises/:enterpriseId/archive-records/documents/gaoxin-package/adopt')
  @RequirePermissions('Enterprise:Profile:Edit')
  adoptGaoxinDocumentPackage(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: EnterpriseWorkspaceAdoptGaoxinDocumentPackageDto) { return this.enterpriseWorkspaceService.adoptGaoxinDocumentPackage(enterpriseId, body.keys, user); }

  @Post('enterprises/:enterpriseId/archive-records/certificates') @RequirePermissions('Enterprise:Profile:Edit') createCertificate(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: EnterpriseWorkspaceCertificateDto) { return this.enterpriseWorkspaceService.createCertificate(enterpriseId, body, user); }
  @Put('enterprises/:enterpriseId/archive-records/certificates/:recordId') @RequirePermissions('Enterprise:Profile:Edit') updateCertificate(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string, @Body() body: EnterpriseWorkspaceCertificateDto) { return this.enterpriseWorkspaceService.updateCertificate(enterpriseId, recordId, body, user); }
  @Delete('enterprises/:enterpriseId/archive-records/certificates/:recordId') @RequirePermissions('Enterprise:Profile:Edit') removeCertificate(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string) { return this.enterpriseWorkspaceService.removeCertificate(enterpriseId, recordId, user); }
  @Post('enterprises/:enterpriseId/archive-records/certificates/batch-delete') @RequirePermissions('Enterprise:Profile:Edit') removeCertificates(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: EnterpriseWorkspaceBatchDeleteDto) { return this.enterpriseWorkspaceService.removeCertificates(enterpriseId, body.ids, user); }

  @Post('enterprises/:enterpriseId/archive-records/accounts') @RequirePermissions('Enterprise:Profile:Edit') createAccount(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: EnterpriseWorkspaceAccountDto) { return this.enterpriseWorkspaceService.createAccount(enterpriseId, body, user); }
  @Put('enterprises/:enterpriseId/archive-records/accounts/:recordId') @RequirePermissions('Enterprise:Profile:Edit') updateAccount(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string, @Body() body: EnterpriseWorkspaceAccountDto) { return this.enterpriseWorkspaceService.updateAccount(enterpriseId, recordId, body, user); }
  @Delete('enterprises/:enterpriseId/archive-records/accounts/:recordId') @RequirePermissions('Enterprise:Profile:Edit') removeAccount(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string) { return this.enterpriseWorkspaceService.removeAccount(enterpriseId, recordId, user); }

  @Get('enterprises/:enterpriseId/photos')
  @RequirePermissions('Enterprise:Profile:List')
  listPhotos(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string) {
    return this.enterpriseWorkspaceService.listPhotos(enterpriseId, user);
  }

  @Post('enterprises/:enterpriseId/photos')
  @RequirePermissions('Enterprise:Profile:Edit')
  createPhoto(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: EnterpriseWorkspacePhotoDto) {
    return this.enterpriseWorkspaceService.createPhoto(enterpriseId, body, user);
  }

  @Put('enterprises/:enterpriseId/photos/:photoId')
  @RequirePermissions('Enterprise:Profile:Edit')
  updatePhoto(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('photoId') photoId: string, @Body() body: EnterpriseWorkspacePhotoDto) {
    return this.enterpriseWorkspaceService.updatePhoto(enterpriseId, photoId, body, user);
  }

  @Delete('enterprises/:enterpriseId/photos/:photoId')
  @RequirePermissions('Enterprise:Profile:Edit')
  removePhoto(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('photoId') photoId: string) {
    return this.enterpriseWorkspaceService.removePhoto(enterpriseId, photoId, user);
  }

  @Post('enterprises/:enterpriseId/finance/financial')
  @RequirePermissions('Enterprise:Profile:Edit')
  createFinancialRecord(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: EnterpriseWorkspaceFinancialRecordDto) {
    return this.enterpriseWorkspaceService.createFinancialRecord(enterpriseId, body, user);
  }

  @Put('enterprises/:enterpriseId/finance/financial/:recordId')
  @RequirePermissions('Enterprise:Profile:Edit')
  updateFinancialRecord(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string, @Body() body: EnterpriseWorkspaceFinancialRecordDto) {
    return this.enterpriseWorkspaceService.updateFinancialRecord(enterpriseId, recordId, body, user);
  }

  @Delete('enterprises/:enterpriseId/finance/financial/:recordId')
  @RequirePermissions('Enterprise:Profile:Edit')
  removeFinancialRecord(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string) {
    return this.enterpriseWorkspaceService.removeFinancialRecord(enterpriseId, recordId, user);
  }

  @Post('enterprises/:enterpriseId/finance/financial/:recordId/restore')
  @RequirePermissions('Enterprise:Profile:Edit')
  restoreFinancialRecord(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string) {
    return this.enterpriseWorkspaceService.restoreFinancialRecord(enterpriseId, recordId, user);
  }

  @Post('enterprises/:enterpriseId/finance/tax-audits')
  @RequirePermissions('Enterprise:Profile:Edit')
  createTaxAudit(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Body() body: EnterpriseWorkspaceTaxAuditDto) {
    return this.enterpriseWorkspaceService.createTaxAudit(enterpriseId, body, user);
  }

  @Put('enterprises/:enterpriseId/finance/tax-audits/:recordId')
  @RequirePermissions('Enterprise:Profile:Edit')
  updateTaxAudit(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string, @Body() body: EnterpriseWorkspaceTaxAuditDto) {
    return this.enterpriseWorkspaceService.updateTaxAudit(enterpriseId, recordId, body, user);
  }

  @Delete('enterprises/:enterpriseId/finance/tax-audits/:recordId')
  @RequirePermissions('Enterprise:Profile:Edit')
  removeTaxAudit(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string) {
    return this.enterpriseWorkspaceService.removeTaxAudit(enterpriseId, recordId, user);
  }

  @Post('enterprises/:enterpriseId/finance/tax-audits/:recordId/restore')
  @RequirePermissions('Enterprise:Profile:Edit')
  restoreTaxAudit(@CurrentUserInfo() user: CurrentUser, @Param('enterpriseId') enterpriseId: string, @Param('recordId') recordId: string) {
    return this.enterpriseWorkspaceService.restoreTaxAudit(enterpriseId, recordId, user);
  }
}
