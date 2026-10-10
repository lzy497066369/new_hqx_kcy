import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { In, IsNull, Like, Repository } from 'typeorm';

import type { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { isEnterpriseCertificateType } from '../../../common/constants/enterprise-certificate-type';
import { normalizeFlowDate, parseFlowDate } from '../../../common/utils/flow-date.util';
import {
  normalizeChineseIdCard,
  parseChineseIdCard,
} from '../../../common/utils/chinese-id-card.util';
import {
  normalizeStoredUploadPath,
  resolveStoredUploadAbsolutePath,
} from '../../../common/utils/upload.util';
import { ClientDeclarationEntity } from '../../../infrastructure/database/entities/client-declaration.entity';
import { EnterpriseProfileStatEntity } from '../../../infrastructure/database/entities/enterprise-profile-stat.entity';
import { EnterpriseProfileStatItemEntity } from '../../../infrastructure/database/entities/enterprise-profile-stat-item.entity';
import { EnterpriseContactEntity } from '../../../infrastructure/database/entities/enterprise-contact.entity';
import { EnterpriseBasicInfoEntity } from '../../../infrastructure/database/entities/enterprise-basic-info.entity';
import { EnterprisePersonEntity } from '../../../infrastructure/database/entities/enterprise-person.entity';
import { EnterpriseFinanceRecordEntity } from '../../../infrastructure/database/entities/enterprise-finance-record.entity';
import { EnterpriseEmployeeRecordEntity } from '../../../infrastructure/database/entities/enterprise-employee-record.entity';
import { EnterprisePropertyRecordEntity } from '../../../infrastructure/database/entities/enterprise-property-record.entity';
import { EnterpriseAccountRecordEntity } from '../../../infrastructure/database/entities/enterprise-account-record.entity';
import { EnterpriseCertificateRecordEntity } from '../../../infrastructure/database/entities/enterprise-certificate-record.entity';
import { EnterpriseContractRecordEntity } from '../../../infrastructure/database/entities/enterprise-contract-record.entity';
import { EnterpriseDocumentRecordEntity } from '../../../infrastructure/database/entities/enterprise-document-record.entity';
import { EnterprisePhotoRecordEntity } from '../../../infrastructure/database/entities/enterprise-photo-record.entity';
import { EnterpriseMaterialParseErrorEntity } from '../../../infrastructure/database/entities/enterprise-material-parse-error.entity';
import { EnterpriseMaterialEntity } from '../../../infrastructure/database/entities/enterprise-material.entity';
import { DeclarationMaterialCheckEntity } from '../../../infrastructure/database/entities/declaration-material-check.entity';
import { DeclarationSchemeEntity } from '../../../infrastructure/database/entities/declaration-scheme.entity';
import { DeclarationPresetEntity } from '../../../infrastructure/database/entities/declaration-preset.entity';
import { PolicyProjectEntity } from '../../../infrastructure/database/entities/policy-project.entity';
import { RegionPolicyFileEntity } from '../../../infrastructure/database/entities/region-policy-file.entity';
import { RegionEntity } from '../../../infrastructure/database/entities/region.entity';
import { OperationLogEntity } from '../../../infrastructure/database/entities/operation-log.entity';
import { EnterpriseProfileService } from '../profile/profile.service';
import { isEnterpriseProfileIncomplete } from '../profile/profile-completeness';
import { ClientService } from '../../client/client.service';
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
  EnterpriseWorkspaceContractDto,
  EnterpriseWorkspaceDocumentDto,
  EnterpriseWorkspaceInvoiceDto,
  EnterpriseWorkspaceDeclarationDraftDto,
  EnterpriseWorkspaceBasicProfileDto,
} from './dto';
import { EnterpriseWorkspacePhotoDto } from './photo.dto';
import {
  normalizeFinanceAmount,
  normalizeFinanceFileClass,
  normalizeFinanceTaxCategory,
  normalizeFinanceYear,
} from './finance-record-rules';

type RiskLevel = 'high' | 'medium' | 'low';

type EnterpriseWorkspaceRisk = {
  code: string;
  description: string;
  level: RiskLevel;
  title: string;
};

type EvidenceChainDomain = 'intellectual_property' | 'research_project' | 'product_service' | 'transformation';

type EvidenceChainBreak = {
  code: string;
  description: string;
  nodeId: string;
  nodeName: string;
  nodeType: EvidenceChainDomain;
  routeName: string;
  severity: 'high' | 'medium';
  title: string;
};

type EvidenceChainNode = {
  code: string;
  id: string;
  links: Partial<Record<EvidenceChainDomain, string[]>>;
  name: string;
  type: EvidenceChainDomain;
};

type EnterpriseWorkspaceTodo = {
  description: string;
  key: string;
  level: RiskLevel;
  routeName: string;
  title: string;
};

type EnterpriseMaterialLedgerItem = {
  enterpriseId: string;
  enterpriseName: string;
  id: string;
  summary: string | null;
  title: string;
  type: EnterpriseMaterialLedgerType;
  updatedAt: Date;
};

type EnterpriseMaterialLedgerType =
  | 'account'
  | 'certificate'
  | 'contract'
  | 'document'
  | 'employee'
  | 'finance'
  | 'intellectual_property'
  | 'invoice'
  | 'photo'
  | 'product_service'
  | 'research_project'
  | 'transformation';

type EmployeeImportFile = {
  filename: string;
  originalname: string;
  path?: string;
  size: number;
};

type MaterialTemplateUploadFile = {
  filename: string;
  originalname: string;
  path?: string;
  size: number;
};

type EnterpriseWorkspaceAttachmentType =
  | 'certificate'
  | 'contract'
  | 'document'
  | 'employee'
  | 'intellectual_property'
  | 'invoice'
  | 'photo'
  | 'tax-audit';

@Injectable()
export class EnterpriseWorkspaceService {
  constructor(
    @InjectRepository(ClientDeclarationEntity)
    private readonly declarationRepo: Repository<ClientDeclarationEntity>,
    @InjectRepository(EnterpriseProfileStatEntity)
    private readonly profileStatRepo: Repository<EnterpriseProfileStatEntity>,
    @InjectRepository(EnterpriseProfileStatItemEntity)
    private readonly profileStatItemRepo: Repository<EnterpriseProfileStatItemEntity>,
    @InjectRepository(EnterpriseContactEntity)
    private readonly contactRepo: Repository<EnterpriseContactEntity>,
    @InjectRepository(EnterpriseBasicInfoEntity)
    private readonly basicInfoRepo: Repository<EnterpriseBasicInfoEntity>,
    @InjectRepository(EnterprisePersonEntity)
    private readonly personRepo: Repository<EnterprisePersonEntity>,
    @InjectRepository(EnterpriseFinanceRecordEntity)
    private readonly financeRecordRepo: Repository<EnterpriseFinanceRecordEntity>,
    @InjectRepository(EnterpriseEmployeeRecordEntity)
    private readonly employeeRecordRepo: Repository<EnterpriseEmployeeRecordEntity>,
    @InjectRepository(EnterprisePropertyRecordEntity)
    private readonly propertyRecordRepo: Repository<EnterprisePropertyRecordEntity>,
    @InjectRepository(EnterpriseAccountRecordEntity)
    private readonly accountRecordRepo: Repository<EnterpriseAccountRecordEntity>,
    @InjectRepository(EnterpriseCertificateRecordEntity)
    private readonly certificateRecordRepo: Repository<EnterpriseCertificateRecordEntity>,
    @InjectRepository(EnterpriseContractRecordEntity)
    private readonly contractRecordRepo: Repository<EnterpriseContractRecordEntity>,
    @InjectRepository(EnterpriseDocumentRecordEntity)
    private readonly documentRecordRepo: Repository<EnterpriseDocumentRecordEntity>,
    @InjectRepository(EnterprisePhotoRecordEntity)
    private readonly photoRecordRepo: Repository<EnterprisePhotoRecordEntity>,
    @InjectRepository(EnterpriseMaterialParseErrorEntity)
    private readonly materialParseErrorRepo: Repository<EnterpriseMaterialParseErrorEntity>,
    @InjectRepository(EnterpriseMaterialEntity)
    private readonly materialRepo: Repository<EnterpriseMaterialEntity>,
    @InjectRepository(DeclarationMaterialCheckEntity)
    private readonly materialCheckRepo: Repository<DeclarationMaterialCheckEntity>,
    @InjectRepository(DeclarationSchemeEntity)
    private readonly declarationSchemeRepo: Repository<DeclarationSchemeEntity>,
    @InjectRepository(DeclarationPresetEntity)
    private readonly declarationPresetRepo: Repository<DeclarationPresetEntity>,
    @InjectRepository(PolicyProjectEntity)
    private readonly policyProjectRepo: Repository<PolicyProjectEntity>,
    @InjectRepository(RegionPolicyFileEntity)
    private readonly regionPolicyFileRepo: Repository<RegionPolicyFileEntity>,
    @InjectRepository(RegionEntity)
    private readonly regionRepo: Repository<RegionEntity>,
    @InjectRepository(OperationLogEntity)
    private readonly operationLogRepo: Repository<OperationLogEntity>,
    private readonly clientService: ClientService,
    private readonly enterpriseProfileService: EnterpriseProfileService,
  ) {}

  async getSummary(enterpriseId: string, currentUser: CurrentUser) {
    // detail() reuses the existing project-teacher enterprise-scope check.
    const profile = await this.enterpriseProfileService.detail(
      enterpriseId,
      currentUser,
    );
    await this.clientService.recalculateEnterpriseProfileStats(profile.id);
    const [profileStat, profileStatItems, declarations, recentOperations, evidenceChain, financialRecords, employeeRecords, propertyRecords, recentMaterials] = await Promise.all([
      this.profileStatRepo.findOne({
        where: { enterpriseId: profile.id },
      }),
      this.profileStatItemRepo.find({
        order: { moduleKey: 'ASC', tabKey: 'ASC' },
        where: { enterpriseId: profile.id },
      }),
      this.declarationRepo.find({
        order: { updatedAt: 'DESC' },
        take: 5,
        where: { enterpriseId: profile.id },
      }),
      this.operationLogRepo.find({
        order: { createdAt: 'DESC' },
        take: 5,
        where: {
          bizId: profile.id,
          requestPath: Like('/enterprise-workspace/%'),
        },
      }),
      this.getEvidenceChainForAccessibleEnterprise(profile.id),
      this.financeRecordRepo.find({
        order: { year: 'DESC', updatedAt: 'DESC' },
        where: { enterpriseId: profile.id, recordType: 'financial', status: 1 },
      }),
      this.employeeRecordRepo.find({
        where: { enterpriseId: profile.id, status: 1 },
      }),
      this.propertyRecordRepo.find({
        where: { enterpriseId: profile.id, status: 1 },
      }),
      this.materialRepo.find({
        order: { updatedAt: 'DESC' },
        take: 5,
        where: { enterpriseId: profile.id },
      }),
    ]);

    const completenessRate = Number(profileStat?.completenessRate ?? 0);
    const healthScore = Number(profileStat?.healthScore ?? 0);
    const activeDeclarations = declarations.filter((item) =>
      ['draft', 'preparing', 'reviewing', 'submitted'].includes(item.status),
    );
    const risks = this.buildRisks({
      declarations,
      completenessRate,
      profileStatus: profile.profileStatus,
      evidenceBreaks: evidenceChain.breaks,
    });

    return {
      declarations: declarations.map((item) => ({
        currentNodeName: item.currentNodeName,
        deadline: item.deadline,
        id: item.id,
        missingMaterialCount: item.missingMaterialCount,
        progress: item.progress,
        projectName: item.projectName,
        rejectedReason: item.rejectedReason,
        status: item.status,
        updatedAt: item.updatedAt,
      })),
      financeTrend: financialRecords
        .filter((item) => Boolean(item.year))
        .slice(0, 3)
        .reverse()
        .map((item) => ({
          highTechIncome: item.highTechIncome,
          rdExpense: item.yffy,
          xxsr: item.xxsr,
          year: item.year,
        })),
      highTechIndicators: {
        financialYears: new Set(financialRecords.map((item) => item.year).filter(Boolean)).size,
        intellectualPropertyCount: propertyRecords.filter((item) => item.recordType === 'intellectual_property').length,
        productServiceCount: propertyRecords.filter((item) => item.recordType === 'product_service').length,
        researchEmployeeCount: employeeRecords.filter((item) => item.isKjyf === 1).length,
        researchProjectCount: propertyRecords.filter((item) => item.recordType === 'research_project').length,
        transformationCount: propertyRecords.filter((item) => item.recordType === 'transformation').length,
      },
      metrics: {
        activeDeclarations: activeDeclarations.length,
        attachmentRecords: profileStat?.attachmentRecords ?? 0,
        completenessRate,
        completedModules: profileStat?.completedModules ?? 0,
        healthScore,
        totalModules: profileStat?.totalModules ?? 0,
      },
      moduleStats: profileStatItems.map((item) => ({
        attachmentCount: item.attachmentCount,
        isCompleted: item.isCompleted === 1,
        itemName: item.itemName,
        missingFields: this.parseJsonStringArray(item.missingFields),
        moduleKey: item.moduleKey,
        moduleName: item.moduleName,
        recordCount: item.recordCount,
        score: Number(item.score),
        tabKey: item.tabKey,
      })),
      profile,
      recentMaterials: recentMaterials.map((item) => ({
        errorCount: item.errorCount,
        fileName: item.fileName,
        id: item.id,
        status: item.status,
        templateName: item.templateName,
        updatedAt: item.updatedAt,
      })),
      recentOperations: recentOperations.map((item) => ({
        action: item.action,
        createdAt: item.createdAt,
        id: item.id,
        module: item.module,
        operatorName: item.realName ?? item.userName ?? '系统',
        success: item.success === 1,
      })),
      risks,
    };
  }

  async getEvidenceChain(enterpriseId: string, currentUser: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, currentUser);
    return this.getEvidenceChainForAccessibleEnterprise(enterpriseId);
  }

  async getOverview(currentUser: CurrentUser) {
    // The list service applies the project-teacher enterprise binding scope.
    const { items: enterprises } = await this.enterpriseProfileService.list(
      { page: '1', pageSize: '100000' },
      currentUser,
    );
    const enterpriseIds = enterprises.map((item) => item.id);
    if (!enterpriseIds.length) {
      return {
        evidenceChainBreaks: 0,
        expiringDeclarations: 0,
        incompleteProfiles: 0,
        materialPending: 0,
        reviewingDeclarations: 0,
        totalEnterprises: 0,
      };
    }

    const now = new Date();
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(now.getDate() + 7);
    const [profileStats, declarations, propertyRecords] = await Promise.all([
      this.profileStatRepo.find({ where: { enterpriseId: In(enterpriseIds) } }),
      this.declarationRepo.find({ where: { enterpriseId: In(enterpriseIds) } }),
      this.propertyRecordRepo.find({
        where: [
          { enterpriseId: In(enterpriseIds), recordType: 'intellectual_property', status: 1 },
          { enterpriseId: In(enterpriseIds), recordType: 'research_project', status: 1 },
          { enterpriseId: In(enterpriseIds), recordType: 'product_service', status: 1 },
          { enterpriseId: In(enterpriseIds), recordType: 'transformation', status: 1 },
        ],
      }),
    ]);
    const profileStatsByEnterpriseId = new Map(
      profileStats.map((item) => [String(item.enterpriseId), item]),
    );
    const propertiesByEnterpriseId = new Map<string, EnterprisePropertyRecordEntity[]>();
    for (const item of propertyRecords) {
      const records = propertiesByEnterpriseId.get(String(item.enterpriseId)) ?? [];
      records.push(item);
      propertiesByEnterpriseId.set(String(item.enterpriseId), records);
    }

    return {
      evidenceChainBreaks: enterpriseIds.reduce(
        (total, enterpriseId) =>
          total + this.buildEvidenceChain(propertiesByEnterpriseId.get(enterpriseId) ?? []).breaks.length,
        0,
      ),
      expiringDeclarations: declarations.filter((item) => {
        const declarationDeadline = normalizeFlowDate(item.deadline, true);
        return Boolean(
          declarationDeadline
          && declarationDeadline >= now
          && declarationDeadline <= sevenDaysLater
          && ['draft', 'preparing', 'reviewing', 'submitted'].includes(item.status),
        );
      }).length,
      incompleteProfiles: enterprises.filter((item) =>
        isEnterpriseProfileIncomplete(
          item.profileStatus,
          profileStatsByEnterpriseId.get(item.id)?.completenessRate,
        ),
      ).length,
      materialPending: declarations.filter((item) => item.missingMaterialCount > 0).length,
      reviewingDeclarations: declarations.filter((item) => item.status === 'reviewing').length,
      totalEnterprises: enterprises.length,
    };
  }

  async getMaterialLedger(
    query: Record<string, string | string[] | undefined>,
    currentUser: CurrentUser,
  ) {
    const enterpriseId = this.getQueryValue(query.enterpriseId)?.trim();
    const type = this.getQueryValue(query.type)?.trim() as
      | EnterpriseMaterialLedgerType
      | undefined;
    const keyword = this.getQueryValue(query.keyword)?.trim().toLowerCase();
    const page = Math.max(Number(this.getQueryValue(query.page) ?? 1), 1);
    const pageSize = Math.min(
      Math.max(Number(this.getQueryValue(query.pageSize) ?? 50), 1),
      100,
    );
    const enterprises = enterpriseId
      ? [await this.enterpriseProfileService.detail(enterpriseId, currentUser)]
      : (
          await this.enterpriseProfileService.list(
            { page: '1', pageSize: '100000' },
            currentUser,
          )
        ).items;
    const enterpriseIds = enterprises.map((item) => item.id);
    if (!enterpriseIds.length) {
      return { items: [], page, pageSize, total: 0 };
    }
    const enterpriseNames = new Map(
      enterprises.map((item) => [item.id, item.name]),
    );
    const [financialRecords, employees, properties, contracts, documents, certificates, accounts, photos] =
      await Promise.all([
        this.financeRecordRepo.find({
          where: { enterpriseId: In(enterpriseIds), recordType: 'financial', status: 1 },
        }),
        this.employeeRecordRepo.find({ where: { enterpriseId: In(enterpriseIds), status: 1 } }),
        this.propertyRecordRepo.find({
          where: [
            { enterpriseId: In(enterpriseIds), recordType: 'intellectual_property', status: 1 },
            { enterpriseId: In(enterpriseIds), recordType: 'research_project', status: 1 },
            { enterpriseId: In(enterpriseIds), recordType: 'product_service', status: 1 },
            { enterpriseId: In(enterpriseIds), recordType: 'transformation', status: 1 },
          ],
        }),
        this.contractRecordRepo.find({
          where: {
            enterpriseId: In(enterpriseIds),
            recordType: In(['contract', 'invoice']),
            status: 1,
          },
        }),
        this.documentRecordRepo.find({ where: { enterpriseId: In(enterpriseIds), status: 1 } }),
        this.certificateRecordRepo.find({ where: { enterpriseId: In(enterpriseIds), status: 1 } }),
        this.accountRecordRepo.find({ where: { enterpriseId: In(enterpriseIds), status: 1 } }),
        this.photoRecordRepo.find({ where: { enterpriseId: In(enterpriseIds), status: 1 } }),
      ]);
    const toItem = (
      record: { enterpriseId: string; id: string; updatedAt: Date },
      materialType: EnterpriseMaterialLedgerType,
      title: null | string,
      summary: null | string,
    ): EnterpriseMaterialLedgerItem => ({
      enterpriseId: String(record.enterpriseId),
      enterpriseName: enterpriseNames.get(String(record.enterpriseId)) ?? '-',
      id: String(record.id),
      summary,
      title: title?.trim() || '-',
      type: materialType,
      updatedAt: record.updatedAt,
    });
    const items: EnterpriseMaterialLedgerItem[] = [
      ...financialRecords.map((item) =>
        toItem(
          item,
          'finance',
          `${item.year ?? '-'} 年度财税资料`,
          [(item.mainBusinessIncome ?? item.totalRevenue) && `营业收入 ${item.mainBusinessIncome ?? item.totalRevenue}`, item.yffy && `研发费用 ${item.yffy}`]
            .filter(Boolean)
            .join('；') || null,
        ),
      ),
      ...employees.map((item) =>
        toItem(item, 'employee', item.ygName, [item.department, item.position].filter(Boolean).join(' / ') || null),
      ),
      ...properties.map((item) => {
        const propertyType = item.recordType as EnterpriseMaterialLedgerType;
        const details: Record<EnterpriseMaterialLedgerType, [null | string, null | string]> = {
          account: [null, null],
          certificate: [null, null],
          contract: [null, null],
          document: [null, null],
          employee: [null, null],
          finance: [null, null],
          intellectual_property: [item.softWorkName ?? item.ipCode, item.softWorkNum ?? item.ipLevel],
          invoice: [null, null],
          photo: [null, null],
          product_service: [item.psName, item.techField ?? item.techSource],
          research_project: [item.kyProjectName, item.kyProjectNum ?? item.kyProjectLeader],
          transformation: [item.transformationName, item.customerName],
        };
        const [title, summary] = details[propertyType];
        return toItem(item, propertyType, title, summary);
      }),
      ...contracts.map((item) =>
        item.recordType === 'invoice'
          ? toItem(item, 'invoice', item.fpNum, [item.fpDate, item.fpMoney && `金额 ${item.fpMoney}`].filter(Boolean).join('；') || null)
          : toItem(item, 'contract', item.htName, [item.htNum, item.khName, item.htMoney && `金额 ${item.htMoney}`].filter(Boolean).join('；') || null),
      ),
      ...documents.map((item) =>
        toItem(item, 'document', item.fileTitle, [item.fileVersion, item.fileStartDate].filter(Boolean).join('；') || null),
      ),
      ...certificates.map((item) =>
        toItem(item, 'certificate', item.zsName, [item.qualificationCode, item.validUntil?.toISOString().slice(0, 10)].filter(Boolean).join('；') || null),
      ),
      ...accounts.map((item) =>
        toItem(item, 'account', item.ptName, [item.zhNumber, item.charge].filter(Boolean).join('；') || null),
      ),
      ...photos.map((item) =>
        toItem(item, 'photo', item.photoTitle, [item.psDate, item.photoDes].filter(Boolean).join('；') || null),
      ),
    ];
    const filtered = items
      .filter((item) => !type || item.type === type)
      .filter((item) => {
        if (!keyword) return true;
        return [item.enterpriseName, item.summary, item.title]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(keyword));
      })
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      page,
      pageSize,
      total: filtered.length,
    };
  }

  async listTodos(enterpriseId: string, currentUser: CurrentUser) {
    const profile = await this.enterpriseProfileService.detail(enterpriseId, currentUser);
    const [declarations, evidenceChain] = await Promise.all([
      this.declarationRepo.find({ order: { updatedAt: 'DESC' }, where: { enterpriseId } }),
      this.getEvidenceChainForAccessibleEnterprise(enterpriseId),
    ]);
    const todos: EnterpriseWorkspaceTodo[] = [];
    if (profile.profileStatus !== 'completed') {
      todos.push({ description: '企业基础信息或协同联系人尚未完成。', key: 'profile-status', level: 'medium', routeName: 'EnterpriseWorkspaceProfile', title: '补齐企业基础档案' });
    }
    const now = new Date();
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(now.getDate() + 7);
    for (const declaration of declarations) {
      if (declaration.status === 'rejected') {
        todos.push({ description: declaration.rejectedReason ?? '审核已退回，请处理补正事项。', key: `declaration-rejected-${declaration.id}`, level: 'high', routeName: 'EnterpriseWorkspaceDeclarations', title: `${declaration.projectName} 待补正` });
      } else if (declaration.missingMaterialCount > 0) {
        todos.push({ description: `材料检查仍缺 ${declaration.missingMaterialCount} 项，请补齐后重新提交。`, key: `declaration-material-${declaration.id}`, level: 'medium', routeName: 'EnterpriseWorkspaceDeclarations', title: `${declaration.projectName} 材料待补` });
      }
      const declarationDeadline = normalizeFlowDate(declaration.deadline, true);
      if (declarationDeadline && declarationDeadline >= now && declarationDeadline <= sevenDaysLater && ['draft', 'preparing', 'reviewing', 'submitted'].includes(declaration.status)) {
        todos.push({ description: `申报截止日期为 ${declarationDeadline.toISOString().slice(0, 10)}。`, key: `declaration-deadline-${declaration.id}`, level: 'high', routeName: 'EnterpriseWorkspaceDeclarations', title: `${declaration.projectName} 即将截止` });
      }
    }
    todos.push(...evidenceChain.breaks.map((item) => ({ description: `${item.nodeName}：${item.description}`, key: item.code, level: item.severity, routeName: item.routeName, title: item.title })));
    return todos.slice(0, 30);
  }

  async listCandidateProjects(enterpriseId: string, currentUser: CurrentUser) {
    const profile = await this.enterpriseProfileService.detail(enterpriseId, currentUser);
    const regionNames = [profile.province, profile.city, profile.district]
      .map((item) => item?.trim())
      .filter((item): item is string => Boolean(item));
    const normalizedNames = new Set(regionNames.flatMap((name) => [name, name.replace(/(省|市|区|县)$/u, '')]));
    const policyRows = await this.regionPolicyFileRepo.find({ where: { status: 'published' } });
    const matchedPolicies = policyRows.filter((item) => {
      const normalized = item.regionName.replace(/(省|市|区|县)$/u, '');
      return normalizedNames.has(item.regionName) || normalizedNames.has(normalized);
    });
    const matchedProjectIds = [...new Set(matchedPolicies.map((item) => item.projectId))];
    const projects = matchedProjectIds.length > 0
      ? await this.policyProjectRepo.find({ where: matchedProjectIds.map((id) => ({ enabled: 1, id })) })
      : await this.policyProjectRepo.find({ where: { enabled: 1 } });
    const projectIds = projects.map((item) => item.id);
    const projectMap = new Map(projects.map((item) => [item.id, item]));
    const now = new Date();
    const result = await Promise.all(projectIds.map(async (projectId) => {
      const project = projectMap.get(projectId);
      if (!project) return null;
      const policies = matchedPolicies.filter((item) => item.projectId === projectId);
      const scheme = await this.resolveWorkspaceScheme(projectId, policies.map((item) => item.regionId), enterpriseId);
      const activeRows = await this.declarationRepo.find({ where: { enterpriseId, projectId } });
      const active = activeRows.find((item) => ['draft', 'preparing', 'reviewing', 'submitted', 'rejected'].includes(item.status));
      const deadline = policies
        .map((item) => item.endDate)
        .filter((item): item is Date => item instanceof Date && item >= now)
        .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
      return {
        canCreate: !active,
        deadline,
        existingDeclarationId: active?.id ?? null,
        id: project.id,
        name: project.name,
        policyFileIds: policies.map((item) => item.id),
        policyCount: policies.length,
        policyType: project.policyType,
        qualificationMissing: scheme?.qualification.missing ?? [],
        scheme: scheme ? { id: scheme.id, name: scheme.name, version: scheme.version } : null,
      };
    }));
    return result.filter((item): item is NonNullable<typeof item> => Boolean(item));
  }

  async createDeclarationDraft(enterpriseId: string, input: EnterpriseWorkspaceDeclarationDraftDto, currentUser: CurrentUser) {
    const profile = await this.enterpriseProfileService.detail(enterpriseId, currentUser);
    const candidates = await this.listCandidateProjects(enterpriseId, currentUser);
    const candidate = candidates.find((item) => item.id === input.projectId);
    if (!candidate) throw new NotFoundException('当前企业未匹配到该申报项目');
    if (!candidate.canCreate) throw new BadRequestException('该项目已有进行中的申报');
    const matchedPolicies = candidate.policyFileIds.length > 0
      ? await this.regionPolicyFileRepo.find({
        where: candidate.policyFileIds.map((id) => ({ id, status: 'published' })),
      })
      : [];
    const fullScheme = await this.resolveWorkspaceScheme(
      candidate.id,
      matchedPolicies.map((item) => item.regionId),
      enterpriseId,
    );
    const policyIds = candidate.policyFileIds.join(',') || null;
    const saved = await this.declarationRepo.save(this.declarationRepo.create({
      currentNodeName: '草稿',
      deadline: candidate.deadline,
      declarationNo: `EW-${Date.now()}`,
      enterpriseId,
      enterpriseName: profile.name,
      missingMaterialCount: 0,
      policyFileIds: policyIds,
      policyType: candidate.policyType,
      progress: 0,
      projectId: candidate.id,
      projectName: candidate.name,
      rejectedReason: null,
      schemeId: fullScheme?.id ?? null,
      schemeVersion: fullScheme?.version ?? null,
      snapshotJson: JSON.stringify({ enterpriseId, policyFileIds: candidate.policyFileIds, scheme: fullScheme, createdFrom: 'enterprise_workspace' }),
      status: 'draft',
      submitTime: null,
    }));
    return this.toDeclarationWorkspaceItem(saved);
  }

  private async resolveWorkspaceScheme(projectId: string, policyRegionIds: Array<null | string>, enterpriseId: string) {
    const schemes = await this.declarationSchemeRepo.find({ where: { projectId, status: 'published' } });
    if (!schemes.length) return null;
    const now = new Date();
    const policyRegionIdSet = new Set(policyRegionIds.filter((item): item is string => Boolean(item)));
    const regionLevels = new Map((await this.regionRepo.find({ where: { status: 1 } })).map((item) => [item.id, item.level]));
    const rank = (regionId: null | string) => {
      const level = regionId ? regionLevels.get(regionId) : undefined;
      return level === 'district' ? 3 : level === 'city' ? 2 : level === 'province' ? 1 : 0;
    };
    const scheme = schemes
      .filter((item) => (!item.regionId || policyRegionIdSet.has(item.regionId)) && (!item.effectiveStartDate || item.effectiveStartDate <= now) && (!item.effectiveEndDate || item.effectiveEndDate >= now))
      .sort((left, right) => rank(right.regionId) - rank(left.regionId) || Number(right.id) - Number(left.id))[0];
    if (!scheme) return null;
    const configuration = await this.resolveDeclarationConfiguration(scheme);
    const qualification = await this.clientService.evaluateEnterpriseQualificationRules(
      enterpriseId,
      configuration.qualification.rules,
    );
    return {
      capabilities: this.parseSnapshot(scheme.capabilitiesJson),
      flowTemplate: configuration.flow.template,
      id: scheme.id,
      materialRules: configuration.material.items,
      name: scheme.schemeName,
      qualification,
      qualificationRules: configuration.qualification.rules,
      scoreRules: configuration.score.rules,
      version: scheme.version,
    };
  }

  private async resolveDeclarationConfiguration(
    scheme: DeclarationSchemeEntity,
    snapshotScheme?: Record<string, unknown>,
  ) {
    const presetIds = [
      scheme.qualificationPresetId,
      scheme.materialPresetId,
      scheme.scorePresetId,
      scheme.flowPresetId,
    ].filter((id): id is string => Boolean(id));
    const presets = presetIds.length
      ? await this.declarationPresetRepo.find({ where: { id: In(presetIds) } })
      : [];
    const presetById = new Map(presets.map((preset) => [String(preset.id), preset]));
    const parseConfigValue = (value: null | string) => {
      if (!value) return {};
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    };
    const toPayload = (presetId: null | string) => {
      const preset = presetId ? presetById.get(String(presetId)) : undefined;
      return preset ? parseConfigValue(preset.payloadJson) : {};
    };
    const hasConfig = (value: unknown) =>
      Array.isArray(value)
        ? value.length > 0
        : Boolean(value && typeof value === 'object' && Object.keys(value).length > 0);
    const selectConfig = (...values: unknown[]) =>
      values.find((value) => hasConfig(value)) ?? {};
    const qualificationRules = selectConfig(
      parseConfigValue(scheme.qualificationRulesJson),
      toPayload(scheme.qualificationPresetId),
      snapshotScheme?.qualificationRules,
    ) as Record<string, unknown>;
    const materialRules = selectConfig(
      parseConfigValue(scheme.materialRulesJson),
      toPayload(scheme.materialPresetId),
      snapshotScheme?.materialRules,
    );
    const scoreRules = selectConfig(
      parseConfigValue(scheme.scoreRulesJson),
      toPayload(scheme.scorePresetId),
      snapshotScheme?.scoreRules,
    ) as Record<string, unknown>;
    const flowTemplate = selectConfig(
      parseConfigValue(scheme.flowTemplateJson),
      toPayload(scheme.flowPresetId),
      snapshotScheme?.flowTemplate,
    ) as Record<string, unknown>;
    const presetMeta = (presetId: null | string) => {
      const preset = presetId ? presetById.get(String(presetId)) : undefined;
      return preset
        ? {
            description: preset.description,
            id: String(preset.id),
            name: preset.name,
            version: preset.version,
          }
        : null;
    };

    return {
      flow: {
        preset: presetMeta(scheme.flowPresetId),
        template: flowTemplate,
      },
      material: {
        items: Array.isArray(materialRules) ? materialRules : [],
        preset: presetMeta(scheme.materialPresetId),
      },
      qualification: {
        preset: presetMeta(scheme.qualificationPresetId),
        rules: qualificationRules,
      },
      scheme: {
        id: String(scheme.id),
        name: scheme.schemeName,
        version: scheme.version,
      },
      score: {
        preset: presetMeta(scheme.scorePresetId),
        rules: scoreRules,
      },
    };
  }

  async listDeclarations(enterpriseId: string, currentUser: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, currentUser);
    const rows = await this.declarationRepo.find({
      order: { updatedAt: 'DESC' },
      where: { enterpriseId },
    });
    return rows.map((row) => this.toDeclarationWorkspaceItem(row));
  }

  async listDeclarationLedger(
    query: Record<string, string | string[] | undefined>,
    currentUser: CurrentUser,
  ) {
    const enterpriseId = this.getQueryValue(query.enterpriseId)?.trim();
    const keyword = this.getQueryValue(query.keyword)?.trim().toLowerCase();
    const missingMaterials = ['1', 'true'].includes(
      this.getQueryValue(query.missingMaterials) ?? '',
    );
    const deadlineWithinDays = Math.min(
      Math.max(Number(this.getQueryValue(query.deadlineWithinDays) ?? 0), 0),
      365,
    );
    const status = this.getQueryValue(query.status)?.trim();
    const requestedPage = Number(this.getQueryValue(query.page) ?? 1);
    const requestedPageSize = Number(this.getQueryValue(query.pageSize) ?? 20);
    const page = Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
    const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0
      ? Math.min(requestedPageSize, 100)
      : 20;
    const enterprises = (
      await this.enterpriseProfileService.list(
        { page: '1', pageSize: '100000' },
        currentUser,
      )
    ).items;
    const visibleEnterpriseIds = new Set(enterprises.map((item) => item.id));
    const enterpriseIds = enterpriseId
      ? visibleEnterpriseIds.has(enterpriseId)
        ? [enterpriseId]
        : []
      : [...visibleEnterpriseIds];

    if (!enterpriseIds.length) {
      return { items: [], page, pageSize, total: 0 };
    }

    const rows = await this.declarationRepo.find({
      order: { updatedAt: 'DESC', id: 'DESC' },
      where: { enterpriseId: In(enterpriseIds) },
    });
    const now = new Date();
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + deadlineWithinDays);
    const filtered = rows.filter((item) => {
      if (status && item.status !== status) return false;
      if (missingMaterials && item.missingMaterialCount <= 0) return false;
      const declarationDeadline = normalizeFlowDate(item.deadline, true);
      if (
        deadlineWithinDays > 0 &&
        (!declarationDeadline
          || declarationDeadline < now
          || declarationDeadline > deadline
          || !['draft', 'preparing', 'reviewing', 'submitted'].includes(item.status))
      ) {
        return false;
      }
      if (!keyword) return true;
      return [item.declarationNo, item.enterpriseName, item.projectName]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(keyword));
    });
    const start = (page - 1) * pageSize;

    return {
      items: filtered.slice(start, start + pageSize).map((item) => ({
        ...this.toDeclarationWorkspaceItem(item),
        enterpriseId: String(item.enterpriseId),
        enterpriseName: item.enterpriseName,
      })),
      page,
      pageSize,
      total: filtered.length,
    };
  }

  async getDeclarationDetail(enterpriseId: string, declarationId: string, currentUser: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, currentUser);
    const declaration = await this.requireWorkspaceDeclaration(enterpriseId, declarationId);
    const [scheme, materialCheck] = await Promise.all([
      declaration.schemeId
        ? this.declarationSchemeRepo.findOne({ where: { id: declaration.schemeId } })
        : null,
      this.clientService.getEnterpriseWorkspaceDeclarationMaterialReadiness(
        enterpriseId,
        declarationId,
      ),
    ]);
    const snapshot = this.parseSnapshot(declaration.snapshotJson);
    const schemeSnapshot = snapshot.scheme as Record<string, unknown> | undefined;
    const policyFileIds = (declaration.policyFileIds ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const currentMatchedScheme = !scheme && policyFileIds.length > 0
      ? await this.regionPolicyFileRepo.find({
          where: policyFileIds.map((id) => ({ id, status: 'published' })),
        }).then((policies) =>
          this.resolveWorkspaceScheme(
            declaration.projectId,
            policies.map((policy) => policy.regionId),
            enterpriseId,
          ),
        )
      : null;
    const snapshotSchemeId =
      typeof schemeSnapshot?.id === 'string' || typeof schemeSnapshot?.id === 'number'
        ? String(schemeSnapshot.id)
        : null;
    const fallbackConfiguration = {
      flow: {
        preset: null,
        template: schemeSnapshot?.flowTemplate ?? {},
      },
      material: {
        items: Array.isArray(schemeSnapshot?.materialRules)
          ? schemeSnapshot.materialRules
          : [],
        preset: null,
      },
      qualification: {
        preset: null,
        rules: schemeSnapshot?.qualificationRules ?? {},
      },
      scheme: snapshotSchemeId
        ? {
            id: snapshotSchemeId,
            name: String(schemeSnapshot?.schemeName ?? ''),
            version: String(schemeSnapshot?.version ?? declaration.schemeVersion ?? ''),
          }
        : null,
      score: {
        preset: null,
        rules: schemeSnapshot?.scoreRules ?? {},
      },
    };
    const configuration = scheme
      ? await this.resolveDeclarationConfiguration(scheme, schemeSnapshot)
      : fallbackConfiguration;
    const qualificationConfig = configuration.qualification.rules as Record<
      string,
      unknown
    >;
    const scoreConfig = configuration.score.rules as Record<string, unknown>;
    const [gaoxinScore, qualification, qualificationDetail] = await Promise.all([
      this.clientService.getEnterpriseWorkspaceDeclarationGaoxinScore(
        enterpriseId,
        declarationId,
        scoreConfig,
      ),
      this.clientService.evaluateEnterpriseQualificationRules(
        enterpriseId,
        qualificationConfig,
      ),
      this.clientService.getEnterpriseQualificationRuleDetails(
        enterpriseId,
        qualificationConfig,
      ),
    ]);
    const flowTemplate = configuration.flow.template as {
      nodes?: Array<{
        code?: string;
        description?: string;
        name?: string;
        qualificationPresetIds?: string[];
        role?: string;
        timeRule?: Record<string, unknown>;
        type?: string;
      }>;
    };
    const nodes = Array.isArray(flowTemplate.nodes) ? flowTemplate.nodes : [];
    const nodeQualifications = await this.clientService.getEnterpriseFlowNodeQualificationDetails(
      enterpriseId,
      nodes,
    );
    const qualificationByCode = new Map(
      nodeQualifications.map((item) => [item.code, item]),
    );
    const flowNodes = nodes.map((node) => {
      const nodeQualification = qualificationByCode.get(node.code ?? '');
      return {
        ...node,
        executionStatus: this.getFlowNodeExecutionStatus(node.timeRule),
        preconditions: nodeQualification?.preconditions ?? [],
        qualificationStatus: nodeQualification?.status ?? 'eligible',
      };
    });
    const flowHistory = Array.isArray(snapshot.schemeFlowHistory)
      ? snapshot.schemeFlowHistory
          .filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === 'object' && !Array.isArray(item),
          )
          .map((item) => ({
            at: typeof item.at === 'string' ? item.at : null,
            from: typeof item.from === 'string' ? item.from : null,
            reason: typeof item.reason === 'string' ? item.reason : null,
            to: typeof item.to === 'string' ? item.to : null,
          }))
      : [];
    return {
      ...this.toDeclarationWorkspaceItem(declaration),
      matchedScheme: currentMatchedScheme
        ? {
            id: String(currentMatchedScheme.id),
            name: currentMatchedScheme.name,
            version: currentMatchedScheme.version,
          }
        : null,
      missingMaterialCount: materialCheck.missingItems,
      configuration: {
        ...configuration,
        flow: { ...configuration.flow, nodes: flowNodes },
        qualification: {
          ...configuration.qualification,
          ...qualificationDetail,
        },
      },
      flowHistory,
      flowTemplate: { nodes: flowNodes },
      gaoxinScore,
      qualification,
      materialCheck: materialCheck,
    };
  }

  async submitDeclarationForReview(enterpriseId: string, declarationId: string, currentUser: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, currentUser);
    const declaration = await this.requireWorkspaceDeclaration(enterpriseId, declarationId);
    if (!['draft', 'preparing', 'rejected'].includes(declaration.status)) {
      throw new BadRequestException('当前申报不在可提交审核状态');
    }
    const readiness = await this.clientService.getEnterpriseWorkspaceDeclarationMaterialReadiness(
      enterpriseId,
      declarationId,
    );
    const snapshot = this.parseSnapshot(declaration.snapshotJson);
    const scheme = snapshot.scheme as {
      qualification?: { missing?: unknown; status?: unknown };
      qualificationRules?: unknown;
    } | undefined;
    const qualification = scheme?.qualificationRules && typeof scheme.qualificationRules === 'object'
      ? await this.clientService.evaluateEnterpriseQualificationRules(
        enterpriseId,
        scheme.qualificationRules as Record<string, unknown>,
      )
      : scheme?.qualification;
    const qualificationMissing = Array.isArray(qualification?.missing)
      ? qualification.missing.filter((item): item is string => typeof item === 'string')
      : [];
    if (readiness.checkStatus !== 'passed' || qualificationMissing.length) {
      declaration.status = 'preparing';
      declaration.missingMaterialCount = readiness.missingItems;
      declaration.currentNodeName = '材料补正';
      declaration.snapshotJson = this.appendFlowHistory(snapshot, {
        from: declaration.currentNodeName ?? '草稿',
        reason: qualificationMissing.length
          ? `资格条件待补齐：${qualificationMissing.join('、')}`
          : `材料准备度未通过，仍缺 ${readiness.missingItems} 项`,
        to: '材料补正',
      });
      await this.declarationRepo.save(declaration);
      throw new BadRequestException(qualificationMissing.length
        ? `暂不满足申报前置条件：${qualificationMissing.join('、')}`
        : `材料尚未齐备，仍缺 ${readiness.missingItems} 项`);
    }
    const previousNode = declaration.currentNodeName ?? '草稿';
    declaration.currentNodeName = '提交审核';
    declaration.missingMaterialCount = 0;
    declaration.progress = Math.max(declaration.progress, 60);
    declaration.rejectedReason = null;
    declaration.status = 'reviewing';
    declaration.submitTime = new Date();
    declaration.snapshotJson = this.appendFlowHistory(snapshot, {
      from: previousNode,
      reason: '材料准备度校验通过，已提交审核',
      to: declaration.currentNodeName,
    });
    return this.toDeclarationWorkspaceItem(await this.declarationRepo.save(declaration));
  }

  async getProfile(enterpriseId: string, currentUser: CurrentUser) {
    return this.enterpriseProfileService.detail(enterpriseId, currentUser);
  }

  async getBasicProfile(enterpriseId: string, currentUser: CurrentUser) {
    const enterprise = await this.enterpriseProfileService.detail(
      enterpriseId,
      currentUser,
    );
    const [basicInfo, contacts, shareholders] = await Promise.all([
      this.basicInfoRepo.findOne({ where: { enterpriseId } }),
      this.contactRepo.find({
        order: { isDefault: 'DESC', id: 'ASC' },
        where: { enterpriseId, status: 1 },
      }),
      this.personRepo.find({
        order: { id: 'ASC' },
        where: { enterpriseId, personType: 'shareholder' },
      }),
    ]);
    const extra = this.getBasicProfileExtra(basicInfo);
    const contact = contacts[0];
    const mainAreas = this.normalizeTextArray(
      extra.mainAreas ?? (basicInfo?.industry ?? enterprise.industry),
    );

    return {
      address: basicInfo?.regLocation ?? enterprise.address,
      companyIntro: this.toNullableUnknownString(extra.companyIntro),
      companyName: basicInfo?.name ?? enterprise.name,
      contactEmail: contact?.email ?? enterprise.contactEmail ?? basicInfo?.email,
      contactFax: this.toNullableUnknownString(extra.contactFax),
      contactIdCard: this.toNullableUnknownString(extra.contactIdCard),
      contactMobile: this.toNullableUnknownString(extra.contactMobile),
      contactName: contact?.name ?? enterprise.contactName,
      contactPhone: contact?.phone ?? enterprise.contactPhone ?? basicInfo?.phoneNumber,
      isInvest: this.toNullableFlag(extra.isInvest),
      isIpo: this.toNullableFlag(extra.isIpo),
      legalPersonIdCard: this.toNullableUnknownString(extra.legalPersonIdCard),
      legalPersonName: basicInfo?.legalPersonName ?? enterprise.legalPerson,
      legalPersonPhone: this.toNullableUnknownString(extra.legalPersonPhone),
      listedCode: this.toNullableUnknownString(extra.listedCode),
      mainAreas,
      province: basicInfo?.province ?? enterprise.province,
      city: basicInfo?.city ?? enterprise.city,
      district: basicInfo?.district ?? enterprise.district,
      registerCapital: this.toNullableNumber(basicInfo?.regCapital),
      registerDate: this.formatBasicProfileDate(basicInfo?.establishTime),
      registerType: basicInfo?.companyOrgType ?? enterprise.enterpriseType,
      shareholders: shareholders.map((item) => this.toBasicProfileShareholder(item)),
      taxId: basicInfo?.creditCode ?? enterprise.creditCode,
      technologyArea: basicInfo?.industry ?? enterprise.industry,
      vcAmount: this.toNullableNumber(extra.vcAmount),
      zipCode: this.toNullableUnknownString(extra.zipCode),
    };
  }

  async updateBasicProfile(
    enterpriseId: string,
    input: EnterpriseWorkspaceBasicProfileDto,
    currentUser: CurrentUser,
  ) {
    const current = await this.getBasicProfile(enterpriseId, currentUser);
    const next = {
      ...current,
      ...Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      ),
    };
    const companyName = this.requireBasicProfileText(next.companyName, '企业名称不能为空');
    const taxId = this.requireBasicProfileText(next.taxId, '统一社会信用代码不能为空');
    const registerType = this.toNullableString(next.registerType);
    const address = this.toNullableString(next.address);
    const legalPersonName = this.toNullableString(next.legalPersonName);
    const contactName = this.toNullableString(next.contactName);
    const contactPhone =
      this.toNullableString(next.contactPhone) ?? this.toNullableString(next.contactMobile);
    const contactEmail = this.toNullableString(next.contactEmail);
    const technologyArea = this.toNullableString(next.technologyArea);
    const province = this.toNullableString(next.province);
    const city = this.toNullableString(next.city);
    const district = this.toNullableString(next.district);

    await this.enterpriseProfileService.update(enterpriseId, {
      address,
      contactEmail,
      contactName,
      contactPhone,
      creditCode: taxId,
      enterpriseType: registerType,
      industry: technologyArea,
      legalPerson: legalPersonName,
      name: companyName,
      province,
      city,
      district,
    }, currentUser);

    const basicInfo =
      (await this.basicInfoRepo.findOne({ where: { enterpriseId } })) ??
      this.basicInfoRepo.create({ enterpriseId, name: companyName });
    const previousExtra = this.parseJsonObject(basicInfo.extraJson);
    basicInfo.creditCode = taxId;
    basicInfo.email = contactEmail;
    basicInfo.establishTime = this.parseBasicProfileDate(next.registerDate);
    basicInfo.industry = technologyArea;
    basicInfo.legalPersonName = legalPersonName;
    basicInfo.name = companyName;
    basicInfo.phoneNumber = contactPhone;
    basicInfo.regCapital = this.toNullableNumericString(next.registerCapital);
    basicInfo.regLocation = address;
    basicInfo.taxNumber = taxId;
    basicInfo.companyOrgType = registerType;
    basicInfo.province = province;
    basicInfo.city = city;
    basicInfo.district = district;
    const workspaceBasicProfile = {
      companyIntro: this.toNullableString(next.companyIntro),
      contactFax: this.toNullableString(next.contactFax),
      contactIdCard: this.toNullableString(next.contactIdCard),
      contactMobile: this.toNullableString(next.contactMobile),
      isInvest: this.toNullableFlag(next.isInvest),
      isIpo: this.toNullableFlag(next.isIpo),
      legalPersonIdCard: this.toNullableString(next.legalPersonIdCard),
      legalPersonPhone: this.toNullableString(next.legalPersonPhone),
      listedCode: this.toNullableString(next.listedCode),
      mainAreas: this.normalizeTextArray(next.mainAreas),
      vcAmount: this.toNullableNumber(next.vcAmount),
      zipCode: this.toNullableString(next.zipCode),
    };
    basicInfo.extraJson = JSON.stringify({
      ...previousExtra,
      clientBasicProfile: {
        companyIntro: workspaceBasicProfile.companyIntro,
        contacts_fax: workspaceBasicProfile.contactFax,
        contacts_idcard: workspaceBasicProfile.contactIdCard,
        contacts_mobile: workspaceBasicProfile.contactMobile,
        is_invest: workspaceBasicProfile.isInvest,
        is_ipo: workspaceBasicProfile.isIpo,
        le_person_idcard: workspaceBasicProfile.legalPersonIdCard,
        le_person_phone: workspaceBasicProfile.legalPersonPhone,
        listedCode: workspaceBasicProfile.listedCode,
        main_areas: workspaceBasicProfile.mainAreas,
        vcAmount: workspaceBasicProfile.vcAmount,
        zip_code: workspaceBasicProfile.zipCode,
      },
      workspaceBasicProfile,
    });
    await this.basicInfoRepo.save(basicInfo);

    await this.upsertWorkspaceDefaultContact(enterpriseId, {
      email: contactEmail,
      name: contactName,
      phone: contactPhone,
    });
    if (Array.isArray(input.shareholders)) {
      await this.replaceBasicProfileShareholders(enterpriseId, input.shareholders);
    }
    return this.getBasicProfile(enterpriseId, currentUser);
  }

  async reviewDeclaration(
    enterpriseId: string,
    declarationId: string,
    input: EnterpriseWorkspaceDeclarationReviewDto,
    currentUser: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, currentUser);
    const declaration = await this.declarationRepo.findOne({
      where: { enterpriseId, id: declarationId },
    });
    if (!declaration) throw new NotFoundException('申报记录不存在');
    if (!['reviewing', 'submitted'].includes(declaration.status)) {
      throw new BadRequestException('当前申报不在可审核状态');
    }

    const snapshot = this.parseSnapshot(declaration.snapshotJson);
    const nodes = this.getFlowNodes(snapshot);
    const currentIndex = Math.max(
      nodes.findIndex((item) => item.name === declaration.currentNodeName),
      0,
    );
    const current = nodes[currentIndex];
    if (!current || (current.code !== 'review' && current.role !== 'consultant')) {
      throw new BadRequestException('当前节点不是顾问审核节点');
    }

    const comment = input.comment?.trim() ||
      (input.action === 'approve' ? '审核通过' : '审核退回，请补充资料');
    if (input.action === 'return') {
      const materialNode = nodes.find((item) => item.type === 'material_completion');
      declaration.currentNodeName = materialNode?.name ?? declaration.currentNodeName;
      declaration.rejectedReason = comment;
      declaration.status = 'preparing';
      declaration.progress = Math.min(Math.max(declaration.progress, 20), 80);
      declaration.snapshotJson = this.appendFlowHistory(snapshot, {
        action: 'return',
        from: current.name,
        operator: currentUser.realName,
        reason: comment,
        to: declaration.currentNodeName ?? '补资料',
      });
    } else {
      const next = nodes[currentIndex + 1];
      declaration.currentNodeName = next?.name ?? declaration.currentNodeName;
      declaration.rejectedReason = null;
      declaration.status = next?.type === 'end' || !next ? 'approved' : 'reviewing';
      declaration.progress = declaration.status === 'approved' ? 100 : Math.max(declaration.progress, 80);
      declaration.snapshotJson = this.appendFlowHistory(snapshot, {
        action: 'approve',
        from: current.name,
        operator: currentUser.realName,
        reason: comment,
        to: next?.name ?? '审核通过',
      });
    }
    return this.toDeclarationSummary(await this.declarationRepo.save(declaration));
  }

  async updateProfile(
    enterpriseId: string,
    input: EnterpriseInput,
    currentUser: CurrentUser,
  ) {
    return this.enterpriseProfileService.update(
      enterpriseId,
      input,
      currentUser,
    );
  }

  async listContacts(enterpriseId: string, currentUser: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, currentUser);
    const contacts = await this.contactRepo.find({
      order: { isDefault: 'DESC', id: 'ASC' },
      where: { enterpriseId, status: 1 },
    });
    return contacts.map((item) => this.toContact(item));
  }

  async createContact(
    enterpriseId: string,
    input: EnterpriseWorkspaceContactDto,
    currentUser: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, currentUser);
    const isDefault =
      input.isDefault === true ||
      (await this.contactRepo.count({ where: { enterpriseId, status: 1 } })) ===
        0;

    if (isDefault) {
      await this.clearDefaultContacts(enterpriseId);
    }

    const contact = await this.contactRepo.save(
      this.contactRepo.create({
        email: this.toNullableString(input.email),
        enterpriseId,
        isDefault: isDefault ? 1 : 0,
        name: this.requireName(input.name),
        phone: this.toNullableString(input.phone),
        position: this.toNullableString(input.position),
        remark: this.toNullableString(input.remark),
        roleName: this.toNullableString(input.roleName),
        status: 1,
      }),
    );

    return this.toContact(contact);
  }

  async updateContact(
    enterpriseId: string,
    contactId: string,
    input: EnterpriseWorkspaceContactDto,
    currentUser: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, currentUser);
    const contact = await this.requireContact(enterpriseId, contactId);

    contact.email = this.toNullableString(input.email);
    contact.name = this.requireName(input.name);
    contact.phone = this.toNullableString(input.phone);
    contact.position = this.toNullableString(input.position);
    contact.remark = this.toNullableString(input.remark);
    contact.roleName = this.toNullableString(input.roleName);

    if (input.isDefault === true) {
      await this.clearDefaultContacts(enterpriseId, contact.id);
      contact.isDefault = 1;
    } else if (input.isDefault === false) {
      contact.isDefault = 0;
    }

    return this.toContact(await this.contactRepo.save(contact));
  }

  async removeContact(
    enterpriseId: string,
    contactId: string,
    currentUser: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, currentUser);
    const contact = await this.requireContact(enterpriseId, contactId);
    await this.contactRepo.remove(contact);
    return null;
  }

  async listFinancialRecords(
    enterpriseId: string,
    currentUser: CurrentUser,
    includeDeleted = false,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, currentUser);
    const records = await this.financeRecordRepo.find({
      order: { year: 'DESC', updatedAt: 'DESC' },
      where: { enterpriseId, recordType: 'financial', status: includeDeleted ? In([0, 1]) : 1 },
    });
    return records.map((item) => this.toFinancialRecord(item));
  }

  async listTaxAudits(
    enterpriseId: string,
    currentUser: CurrentUser,
    includeDeleted = false,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, currentUser);
    const records = await this.financeRecordRepo.find({
      order: { year: 'DESC', updatedAt: 'DESC' },
      where: { enterpriseId, recordType: 'tax_audit', status: includeDeleted ? In([0, 1]) : 1 },
    });
    return records.map((item) => this.toTaxAudit(item));
  }

  async listEmployees(
    enterpriseId: string,
    user: CurrentUser,
    query: Record<string, string | string[] | undefined> = {},
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const keyword = this.getQueryValue(query.keyword)?.trim();
    const activeStatus = this.getQueryValue(query.activeStatus)?.trim();
    const researchStatus = this.getQueryValue(query.researchStatus)?.trim();
    const employeeType = Number(this.getQueryValue(query.employeeType));
    const page = Math.max(Number(this.getQueryValue(query.page) ?? 1), 1);
    const pageSize = Math.min(
      Math.max(Number(this.getQueryValue(query.pageSize) ?? 20), 1),
      100,
    );
    const builder = this.employeeRecordRepo
      .createQueryBuilder('employee')
      .where('employee.enterpriseId = :enterpriseId', { enterpriseId })
      .andWhere('employee.status = :status', { status: 1 });

    if (keyword) {
      builder.andWhere(
        '(employee.ygName LIKE :keyword OR employee.idCard LIKE :keyword OR employee.department LIKE :keyword OR employee.position LIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }
    if (activeStatus === 'active' || activeStatus === 'inactive') {
      builder.andWhere('employee.isActive = :isActive', {
        isActive: activeStatus === 'active' ? 1 : 0,
      });
    }
    if (researchStatus === 'yes' || researchStatus === 'no') {
      builder.andWhere('employee.isKjyf = :isKjyf', {
        isKjyf: researchStatus === 'yes' ? 1 : 0,
      });
    }
    if ([1, 2, 3, 4].includes(employeeType)) {
      builder.andWhere('employee.ygLx = :employeeType', { employeeType });
    }

    const [items, total] = await builder
      .orderBy('employee.updatedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    const [allCount, activeCount, researchCount] = await Promise.all([
      this.employeeRecordRepo.count({ where: { enterpriseId, status: 1 } }),
      this.employeeRecordRepo.count({ where: { enterpriseId, isActive: 1, status: 1 } }),
      this.employeeRecordRepo.count({ where: { enterpriseId, isActive: 1, isKjyf: 1, status: 1 } }),
    ]);
    return {
      items: items.map((item) => this.toEmployee(item)),
      page,
      pageSize,
      stats: { activeCount, researchCount, total: allCount },
      total,
    };
  }

  async createEmployee(
    enterpriseId: string,
    input: EnterpriseWorkspaceEmployeeDto,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    await this.assertEmployeeAttachmentPaths(enterpriseId, input);
    const employeeData = this.toEmployeeEntityData(input);
    await this.assertEmployeeIdCardUnique(enterpriseId, employeeData.idCard);
    const employee = this.employeeRecordRepo.create({
      ...employeeData,
      enterpriseId,
      status: 1,
    });
    const saved = await this.employeeRecordRepo.save(employee);
    await this.clientService.recalculateEnterpriseProfileStats(enterpriseId);
    return this.toEmployee(saved);
  }

  async updateEmployee(
    enterpriseId: string,
    employeeId: string,
    input: EnterpriseWorkspaceEmployeeDto,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const employee = await this.requireEmployee(enterpriseId, employeeId);
    await this.assertEmployeeAttachmentPaths(enterpriseId, input, employee);
    const employeeData = this.toEmployeeEntityData(input);
    await this.assertEmployeeIdCardUnique(
      enterpriseId,
      employeeData.idCard,
      employeeId,
    );
    Object.assign(employee, employeeData);
    const saved = await this.employeeRecordRepo.save(employee);
    await this.clientService.recalculateEnterpriseProfileStats(enterpriseId);
    return this.toEmployee(saved);
  }

  async uploadEmployeeAttachment(
    enterpriseId: string,
    file: EmployeeImportFile | undefined,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const path = normalizeStoredUploadPath(file?.path);
    if (!path || !this.isEmployeeAttachmentPathForEnterprise(enterpriseId, path)) {
      throw new BadRequestException('员工附件上传失败');
    }
    return { path };
  }

  async removeEmployee(
    enterpriseId: string,
    employeeId: string,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const employee = await this.requireEmployee(enterpriseId, employeeId);
    employee.status = 0;
    await this.employeeRecordRepo.save(employee);
    await this.clientService.recalculateEnterpriseProfileStats(enterpriseId);
    return null;
  }

  async downloadEmployeeImportTemplate(
    enterpriseId: string,
    user: CurrentUser,
    response: Response,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.downloadEmployeeImportTemplate(response);
  }

  async exportEmployees(
    enterpriseId: string,
    user: CurrentUser,
    response: Response,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.exportEnterpriseEmployees(enterpriseId, response);
  }

  async uploadFinanceAiParseFiles(
    enterpriseId: string,
    user: CurrentUser,
    files: EmployeeImportFile[],
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.uploadEnterpriseFinanceAiParseFiles(
      enterpriseId,
      String(user.id),
      files,
    );
  }

  async listFinanceAiParseDrafts(enterpriseId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.listEnterpriseFinanceAiParseDrafts(enterpriseId);
  }

  async approveFinanceAiParseDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: string[],
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.approveEnterpriseFinanceAiParseDrafts(
      enterpriseId,
      String(user.id),
      { ids },
    );
  }

  async updateFinanceAiParseDraft(
    enterpriseId: string,
    draftId: string,
    input: { data?: Record<string, unknown> },
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.updateEnterpriseFinanceAiParseDraft(
      enterpriseId,
      draftId,
      { data: input.data ?? {} },
    );
  }

  async rejectFinanceAiParseDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: string[],
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.rejectEnterpriseFinanceAiParseDrafts(
      enterpriseId,
      String(user.id),
      { ids },
    );
  }

  async retryFinanceAiParseDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: string[],
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.retryEnterpriseFinanceAiParseDrafts(enterpriseId, { ids });
  }

  async removeFinanceAiParseDraft(
    enterpriseId: string,
    draftId: string,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.deleteEnterpriseFinanceAiParseDraft(enterpriseId, draftId);
  }

  getMaterialTemplates() {
    return this.clientService.getEnterpriseMaterialTemplates();
  }

  async downloadMaterialTemplate(templateId: string, response: Response) {
    await this.clientService.downloadEnterpriseMaterialTemplate(templateId, response);
  }

  async getEnterpriseMaterials(enterpriseId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.getEnterpriseMaterials(enterpriseId);
  }

  async previewEnterpriseMaterial(
    enterpriseId: string,
    materialId: string,
    user: CurrentUser,
    response: Response,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    await this.clientService.previewEnterpriseMaterial(
      enterpriseId,
      materialId,
      response,
    );
  }

  async previewEnterpriseAttachment(
    enterpriseId: string,
    attachmentType: EnterpriseWorkspaceAttachmentType,
    recordId: string,
    filePath: string,
    user: CurrentUser,
    response: Response,
  ): Promise<void> {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const permittedPaths = await this.getAttachmentPaths(
      enterpriseId,
      attachmentType,
      recordId,
    );
    const requestedPath = normalizeStoredUploadPath(filePath);
    if (!requestedPath || !permittedPaths.includes(requestedPath)) {
      throw new NotFoundException('附件不存在');
    }

    const { absolutePath, storedPath } = resolveStoredUploadAbsolutePath(
      requestedPath,
    );
    const fileStat = await stat(absolutePath).catch(() => null);
    if (!fileStat?.isFile()) {
      throw new NotFoundException('附件不存在');
    }

    const filename = basename(storedPath);
    response.setHeader('Content-Length', String(fileStat.size));
    response.setHeader('Content-Type', this.getAttachmentContentType(filename));
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(filename)}"`,
    );
    await pipeline(createReadStream(absolutePath), response);
  }

  async getEnterpriseMaterialErrors(
    enterpriseId: string,
    materialId: string,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const material = await this.materialRepo.findOne({
      where: { enterpriseId, id: materialId },
    });
    if (!material) {
      throw new NotFoundException('材料记录不存在');
    }

    const errors = await this.materialParseErrorRepo.find({
      order: { rowNumber: 'ASC', id: 'ASC' },
      where: { enterpriseId, materialId: material.id },
    });

    return errors.map((error) => ({
      fieldName: error.fieldName,
      id: String(error.id),
      message: error.errorMessage,
      rawValue: error.rawValue,
      rowNumber: error.rowNumber,
      sheetName: error.sheetName,
      suggestion: error.suggestion,
    }));
  }

  async uploadEnterpriseMaterial(
    enterpriseId: string,
    templateId: string,
    file: MaterialTemplateUploadFile,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.uploadEnterpriseMaterial(
      enterpriseId,
      templateId,
      file,
    );
  }

  async previewEmployeeImport(
    enterpriseId: string,
    file: EmployeeImportFile,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.previewEnterpriseEmployeeImport(enterpriseId, file);
  }

  async confirmEmployeeImport(
    enterpriseId: string,
    input: { materialId?: string; skippedKeys?: string[] },
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.confirmEnterpriseEmployeeImport(enterpriseId, input);
  }

  async listIntellectualProperties(enterpriseId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const items = this.sortWorkspacePropertyRowsByIpCode(
      await this.propertyRecordRepo.find({ where: { enterpriseId, recordType: 'intellectual_property', status: 1 } }),
      [],
    );
    return { items: items.map((item) => this.toIntellectualProperty(item)), stats: { coreCount: items.filter((item) => item.isCoreIp === 1).length, grantedCount: items.filter((item) => item.softWorkStatus === 2).length, total: items.length } };
  }

  async uploadIpRecognitionPdfs(
    enterpriseId: string,
    user: CurrentUser,
    files: EmployeeImportFile[],
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.uploadEnterpriseIpRecognitionPdfs(
      enterpriseId,
      String(user.id),
      files,
    );
  }

  async listIpRecognitionDrafts(enterpriseId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.listEnterpriseIpRecognitionDrafts(enterpriseId);
  }

  async listAiTasks(enterpriseId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.listEnterpriseWorkspaceAiTasks(enterpriseId);
  }

  async removeAiTask(enterpriseId: string, taskId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.deleteEnterpriseWorkspaceAiTask(enterpriseId, taskId);
  }

  async approveIpRecognitionDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: Array<number | string>,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.approveEnterpriseIpRecognitionDrafts(
      enterpriseId,
      String(user.id),
      { ids },
    );
  }

  async updateIpRecognitionDraft(
    enterpriseId: string,
    draftId: string,
    input: { data?: Record<string, unknown> },
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.updateEnterpriseIpRecognitionDraft(
      enterpriseId,
      draftId,
      { data: input.data ?? {} },
    );
  }

  async rejectIpRecognitionDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: Array<number | string>,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.rejectEnterpriseIpRecognitionDrafts(
      enterpriseId,
      String(user.id),
      { ids },
    );
  }

  async retryIpRecognitionDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: Array<number | string>,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.retryEnterpriseIpRecognitionDrafts(
      enterpriseId,
      String(user.id),
      { ids },
    );
  }

  async removeIpRecognitionDraft(
    enterpriseId: string,
    draftId: string,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.deleteEnterpriseIpRecognitionDraft(
      enterpriseId,
      draftId,
    );
  }

  async createTransformationGenerationTask(
    enterpriseId: string,
    user: CurrentUser,
    input: { businessMode?: 'auto' | 'mixed' | 'product' | 'service'; ipIds?: string[]; targetCount?: number },
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.createEnterpriseTransformationGenerationTask(
      enterpriseId,
      String(user.id),
      input,
    );
  }

  async listTransformationGenerationDrafts(
    enterpriseId: string,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.listEnterpriseTransformationGenerationDrafts(enterpriseId);
  }

  async approveTransformationGenerationDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: Array<number | string>,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.approveEnterpriseTransformationGenerationDrafts(
      enterpriseId,
      String(user.id),
      { ids },
    );
  }

  async createResearchAutoMatchTask(
    enterpriseId: string,
    user: CurrentUser,
    input: { ipIds?: string[]; targetCount?: number },
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.createEnterpriseResearchAutoMatchTask(
      enterpriseId,
      String(user.id),
      input,
    );
  }

  async listResearchGenerationDrafts(enterpriseId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.listEnterpriseResearchGenerationDrafts(enterpriseId);
  }

  async approveResearchGenerationDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: Array<number | string>,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.approveEnterpriseResearchGenerationDrafts(
      enterpriseId,
      String(user.id),
      { ids },
    );
  }

  async deleteResearchGenerationDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: Array<number | string>,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.deleteEnterpriseResearchGenerationDrafts(
      enterpriseId,
      { ids },
    );
  }

  async createProductServiceGenerationTask(
    enterpriseId: string,
    user: CurrentUser,
    input: { businessMode?: 'auto' | 'mixed' | 'product' | 'service'; includeExisting?: boolean; rdIds?: string[]; targetCount?: number },
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.createEnterpriseProductServiceGenerationTask(
      enterpriseId,
      String(user.id),
      input,
    );
  }

  async listProductServiceGenerationDrafts(
    enterpriseId: string,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.listEnterpriseProductServiceGenerationDrafts(enterpriseId);
  }

  async approveProductServiceGenerationDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: Array<number | string>,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.approveEnterpriseProductServiceGenerationDrafts(
      enterpriseId,
      String(user.id),
      { ids },
    );
  }

  async createIntellectualProperty(enterpriseId: string, input: EnterpriseWorkspaceIntellectualPropertyDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    await this.assertPropertyRelationsBelongToEnterprise(enterpriseId, input);
    const property = this.propertyRecordRepo.create({ ...this.toIntellectualPropertyEntityData(input), enterpriseId, ipCode: `IP-${Date.now()}`, recordType: 'intellectual_property', status: 1 });
    return this.toIntellectualProperty(await this.propertyRecordRepo.save(property));
  }

  async updateIntellectualProperty(enterpriseId: string, propertyId: string, input: EnterpriseWorkspaceIntellectualPropertyDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    await this.assertPropertyRelationsBelongToEnterprise(enterpriseId, input);
    const property = await this.propertyRecordRepo.findOne({ where: { enterpriseId, id: propertyId, recordType: 'intellectual_property', status: 1 } });
    if (!property) throw new NotFoundException('知识产权记录不存在');
    Object.assign(property, this.toIntellectualPropertyEntityData(input));
    return this.toIntellectualProperty(await this.propertyRecordRepo.save(property));
  }

  async removeIntellectualProperty(enterpriseId: string, propertyId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const property = await this.propertyRecordRepo.findOne({ where: { enterpriseId, id: propertyId, recordType: 'intellectual_property', status: 1 } });
    if (!property) throw new NotFoundException('知识产权记录不存在');
    await this.propertyRecordRepo.remove(property);
    return null;
  }

  async clearPropertyResearchData(enterpriseId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const recordTypes = [
      'intellectual_property',
      'research_project',
      'product_service',
      'transformation',
    ];
    const materials = await this.materialRepo.find({
      select: { id: true },
      where: {
        enterpriseId,
        materialType: In([...recordTypes, 'property_ip_pdf']),
      },
    });
    const materialIds = materials.map((item) => item.id);
    const [recordResult, draftCount, materialResult] = await Promise.all([
      this.propertyRecordRepo.delete({
        enterpriseId,
        recordType: In(recordTypes),
      }),
      this.clientService.clearEnterprisePropertyResearchDrafts(enterpriseId),
      this.materialRepo.delete({
        enterpriseId,
        materialType: In([...recordTypes, 'property_ip_pdf']),
      }),
      materialIds.length
        ? this.materialParseErrorRepo.delete({
            enterpriseId,
            materialId: In(materialIds),
          })
        : Promise.resolve(),
    ]);
    const recordCount = recordResult.affected ?? 0;
    const materialCount = materialResult.affected ?? 0;
    return {
      draftCount,
      materialCount,
      recordCount,
      total: recordCount + draftCount + materialCount,
    };
  }

  async previewIntellectualPropertySourceFile(
    enterpriseId: string,
    propertyId: string,
    user: CurrentUser,
    response: Response,
  ): Promise<void> {
    const property = await this.propertyRecordRepo.findOne({
      where: { enterpriseId, id: propertyId, recordType: 'intellectual_property', status: 1 },
    });
    if (!property) throw new NotFoundException('知识产权记录不存在');
    if (!property.softWorkFile) throw new NotFoundException('源文件不存在');
    await this.previewEnterpriseAttachment(
      enterpriseId,
      'intellectual_property',
      propertyId,
      property.softWorkFile,
      user,
      response,
    );
  }

  async listResearchProjects(enterpriseId: string, user: CurrentUser) { await this.assertEnterpriseAccessible(enterpriseId, user); const [items, ipRows] = await Promise.all([this.propertyRecordRepo.find({ where: { enterpriseId, recordType: 'research_project', status: 1 } }), this.propertyRecordRepo.find({ where: { enterpriseId, recordType: 'intellectual_property', status: 1 } })]); return this.sortWorkspacePropertyRowsByIpCode(items, ipRows).map((item) => this.toResearchProject(item)); }
  async createResearchProject(enterpriseId: string, input: EnterpriseWorkspaceResearchProjectDto, user: CurrentUser) { await this.assertEnterpriseAccessible(enterpriseId, user); await this.assertPropertyRelationsBelongToEnterprise(enterpriseId, input); await this.assertPropertyNameUnique(enterpriseId, 'research_project', input.kyProjectName); const item = this.propertyRecordRepo.create({ ...this.toResearchProjectEntityData(input), enterpriseId, recordType: 'research_project', status: 1 }); return this.toResearchProject(await this.propertyRecordRepo.save(item)); }
  async updateResearchProject(enterpriseId: string, propertyId: string, input: EnterpriseWorkspaceResearchProjectDto, user: CurrentUser) { await this.assertEnterpriseAccessible(enterpriseId, user); await this.assertPropertyRelationsBelongToEnterprise(enterpriseId, input); const item = await this.propertyRecordRepo.findOne({ where: { enterpriseId, id: propertyId, recordType: 'research_project', status: 1 } }); if (!item) throw new NotFoundException('研发项目不存在'); await this.assertPropertyNameUnique(enterpriseId, 'research_project', input.kyProjectName, propertyId); Object.assign(item, this.toResearchProjectEntityData(input)); return this.toResearchProject(await this.propertyRecordRepo.save(item)); }
  async removeResearchProject(enterpriseId: string, propertyId: string, user: CurrentUser) { await this.assertEnterpriseAccessible(enterpriseId, user); const item = await this.propertyRecordRepo.findOne({ where: { enterpriseId, id: propertyId, recordType: 'research_project', status: 1 } }); if (!item) throw new NotFoundException('研发项目不存在'); await this.propertyRecordRepo.remove(item); return null; }
  async listProductServices(enterpriseId: string, user: CurrentUser) { await this.assertEnterpriseAccessible(enterpriseId, user); const [items, ipRows] = await Promise.all([this.propertyRecordRepo.find({ where: { enterpriseId, recordType: 'product_service', status: 1 } }), this.propertyRecordRepo.find({ where: { enterpriseId, recordType: 'intellectual_property', status: 1 } })]); return this.sortWorkspacePropertyRowsByIpCode(items, ipRows).map((item) => this.toProductService(item)); }
  async createProductService(enterpriseId: string, input: EnterpriseWorkspaceProductServiceDto, user: CurrentUser) { await this.assertEnterpriseAccessible(enterpriseId, user); await this.assertPropertyRelationsBelongToEnterprise(enterpriseId, input); await this.assertPropertyNameUnique(enterpriseId, 'product_service', input.psName); const item = this.propertyRecordRepo.create({ ...this.toProductServiceEntityData(input), enterpriseId, recordType: 'product_service', status: 1 }); return this.toProductService(await this.propertyRecordRepo.save(item)); }
  async updateProductService(enterpriseId: string, propertyId: string, input: EnterpriseWorkspaceProductServiceDto, user: CurrentUser) { await this.assertEnterpriseAccessible(enterpriseId, user); await this.assertPropertyRelationsBelongToEnterprise(enterpriseId, input); const item = await this.propertyRecordRepo.findOne({ where: { enterpriseId, id: propertyId, recordType: 'product_service', status: 1 } }); if (!item) throw new NotFoundException('产品服务不存在'); await this.assertPropertyNameUnique(enterpriseId, 'product_service', input.psName, propertyId); Object.assign(item, this.toProductServiceEntityData(input)); return this.toProductService(await this.propertyRecordRepo.save(item)); }
  async removeProductService(enterpriseId: string, propertyId: string, user: CurrentUser) { await this.assertEnterpriseAccessible(enterpriseId, user); const item = await this.propertyRecordRepo.findOne({ where: { enterpriseId, id: propertyId, recordType: 'product_service', status: 1 } }); if (!item) throw new NotFoundException('产品服务不存在'); await this.propertyRecordRepo.remove(item); return null; }
  async listTransformations(enterpriseId: string, user: CurrentUser) { await this.assertEnterpriseAccessible(enterpriseId, user); const [items, ipRows] = await Promise.all([this.propertyRecordRepo.find({ where: { enterpriseId, recordType: 'transformation', status: 1 } }), this.propertyRecordRepo.find({ where: { enterpriseId, recordType: 'intellectual_property', status: 1 } })]); const changed = items.filter((item) => { const name = this.normalizeTransformationName(item.transformationName); if (item.transformationName === name) return false; item.transformationName = name; return true; }); if (changed.length) await this.propertyRecordRepo.save(changed); return this.sortWorkspacePropertyRowsByIpCode(items, ipRows).map((item) => this.toTransformation(item)); }
  async createTransformation(enterpriseId: string, input: EnterpriseWorkspaceTransformationDto, user: CurrentUser) { await this.assertEnterpriseAccessible(enterpriseId, user); await this.assertPropertyRelationsBelongToEnterprise(enterpriseId, input); const name = this.normalizeTransformationName(input.transformationName); await this.assertPropertyNameUnique(enterpriseId, 'transformation', name); const item = this.propertyRecordRepo.create({ ...this.toTransformationEntityData({ ...input, transformationName: name }), enterpriseId, recordType: 'transformation', status: 1 }); return this.toTransformation(await this.propertyRecordRepo.save(item)); }
  async updateTransformation(enterpriseId: string, propertyId: string, input: EnterpriseWorkspaceTransformationDto, user: CurrentUser) { await this.assertEnterpriseAccessible(enterpriseId, user); await this.assertPropertyRelationsBelongToEnterprise(enterpriseId, input); const item = await this.propertyRecordRepo.findOne({ where: { enterpriseId, id: propertyId, recordType: 'transformation', status: 1 } }); if (!item) throw new NotFoundException('成果转化不存在'); const name = this.normalizeTransformationName(input.transformationName); await this.assertPropertyNameUnique(enterpriseId, 'transformation', name, propertyId); Object.assign(item, this.toTransformationEntityData({ ...input, transformationName: name })); return this.toTransformation(await this.propertyRecordRepo.save(item)); }
  async removeTransformation(enterpriseId: string, propertyId: string, user: CurrentUser) { await this.assertEnterpriseAccessible(enterpriseId, user); const item = await this.propertyRecordRepo.findOne({ where: { enterpriseId, id: propertyId, recordType: 'transformation', status: 1 } }); if (!item) throw new NotFoundException('成果转化不存在'); await this.propertyRecordRepo.remove(item); return null; }

  async listArchiveRecords(enterpriseId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const [contracts, invoices, documents, certificates, accounts] = await Promise.all([
      this.contractRecordRepo.find({ where: { enterpriseId, recordType: 'contract', status: 1 }, order: { updatedAt: 'DESC' } }),
      this.contractRecordRepo.find({ where: { enterpriseId, recordType: 'invoice', status: 1 }, order: { updatedAt: 'DESC' } }),
      this.documentRecordRepo.find({ where: { enterpriseId, status: 1 }, order: { updatedAt: 'DESC' } }),
      this.certificateRecordRepo.find({ where: { enterpriseId, status: 1 }, order: { updatedAt: 'DESC' } }),
      this.accountRecordRepo.find({ where: { enterpriseId, status: 1 }, order: { updatedAt: 'DESC' } }),
    ]);
    return {
      accounts: accounts.map((item) => this.toAccount(item)),
      certificates: certificates.map((item) => this.toCertificate(item)),
      contracts: contracts.map((item) => this.toContract(item)),
      documents: documents.map((item) => this.toDocument(item)),
      invoices: invoices.map((item) => this.toInvoice(item)),
    };
  }

  async uploadContractRecognitionPdfs(
    enterpriseId: string,
    user: CurrentUser,
    files: EmployeeImportFile[],
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.uploadEnterpriseContractRecognitionPdfs(
      enterpriseId,
      String(user.id),
      files,
    );
  }

  async listContractRecognitionDrafts(enterpriseId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.listEnterpriseContractRecognitionDrafts(enterpriseId);
  }

  async approveContractRecognitionDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: Array<number | string>,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.approveEnterpriseContractRecognitionDrafts(
      enterpriseId,
      String(user.id),
      { ids },
    );
  }

  async updateContractRecognitionDraft(
    enterpriseId: string,
    draftId: string,
    input: { data?: Record<string, unknown> },
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.updateEnterpriseContractRecognitionDraft(
      enterpriseId,
      draftId,
      { data: input.data ?? {} },
    );
  }

  async rejectContractRecognitionDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: Array<number | string>,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.rejectEnterpriseContractRecognitionDrafts(
      enterpriseId,
      String(user.id),
      { ids },
    );
  }

  async retryContractRecognitionDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: Array<number | string>,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.retryEnterpriseContractRecognitionDrafts(
      enterpriseId,
      String(user.id),
      { ids },
    );
  }

  async removeContractRecognitionDraft(
    enterpriseId: string,
    draftId: string,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.deleteEnterpriseContractRecognitionDraft(
      enterpriseId,
      draftId,
    );
  }

  async uploadInvoiceRecognitionPdfs(
    enterpriseId: string,
    user: CurrentUser,
    files: EmployeeImportFile[],
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.uploadEnterpriseInvoiceRecognitionPdfs(
      enterpriseId,
      String(user.id),
      files,
    );
  }

  async listInvoiceRecognitionDrafts(enterpriseId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.listEnterpriseInvoiceRecognitionDrafts(enterpriseId);
  }

  async approveInvoiceRecognitionDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: Array<number | string>,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.approveEnterpriseInvoiceRecognitionDrafts(
      enterpriseId,
      String(user.id),
      { ids },
    );
  }

  async updateInvoiceRecognitionDraft(
    enterpriseId: string,
    draftId: string,
    input: { data?: Record<string, unknown> },
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.updateEnterpriseInvoiceRecognitionDraft(
      enterpriseId,
      draftId,
      { data: input.data ?? {} },
    );
  }

  async rejectInvoiceRecognitionDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: Array<number | string>,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.rejectEnterpriseInvoiceRecognitionDrafts(
      enterpriseId,
      String(user.id),
      { ids },
    );
  }

  async retryInvoiceRecognitionDrafts(
    enterpriseId: string,
    user: CurrentUser,
    ids: Array<number | string>,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.retryEnterpriseInvoiceRecognitionDrafts(
      enterpriseId,
      String(user.id),
      { ids },
    );
  }

  async removeInvoiceRecognitionDraft(
    enterpriseId: string,
    draftId: string,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.deleteEnterpriseInvoiceRecognitionDraft(
      enterpriseId,
      draftId,
    );
  }

  async createContract(enterpriseId: string, input: EnterpriseWorkspaceContractDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    await this.assertArchiveAttachmentPaths(enterpriseId, input);
    return this.toContract(await this.contractRecordRepo.save(this.contractRecordRepo.create({ ...this.toContractEntityData(input), enterpriseId, recordType: 'contract', status: 1 })));
  }

  async updateContract(enterpriseId: string, recordId: string, input: EnterpriseWorkspaceContractDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const item = await this.requireContractRecord(enterpriseId, recordId, 'contract', '合同');
    await this.assertArchiveAttachmentPaths(enterpriseId, input, item);
    Object.assign(item, this.toContractEntityData(input));
    return this.toContract(await this.contractRecordRepo.save(item));
  }

  async removeContract(enterpriseId: string, recordId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    await this.contractRecordRepo.remove(await this.requireContractRecord(enterpriseId, recordId, 'contract', '合同'));
    return null;
  }

  async createInvoice(enterpriseId: string, input: EnterpriseWorkspaceInvoiceDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    await this.assertArchiveAttachmentPaths(enterpriseId, input);
    const invoiceData = await this.toInvoiceEntityData(enterpriseId, input);
    return this.toInvoice(await this.contractRecordRepo.save(this.contractRecordRepo.create({ ...invoiceData, enterpriseId, recordType: 'invoice', status: 1 })));
  }

  async updateInvoice(enterpriseId: string, recordId: string, input: EnterpriseWorkspaceInvoiceDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const item = await this.requireContractRecord(enterpriseId, recordId, 'invoice', '发票');
    await this.assertArchiveAttachmentPaths(enterpriseId, input, item);
    Object.assign(item, await this.toInvoiceEntityData(enterpriseId, input));
    return this.toInvoice(await this.contractRecordRepo.save(item));
  }

  async removeInvoice(enterpriseId: string, recordId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    await this.contractRecordRepo.remove(await this.requireContractRecord(enterpriseId, recordId, 'invoice', '发票'));
    return null;
  }

  async createDocument(enterpriseId: string, input: EnterpriseWorkspaceDocumentDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    this.assertDocumentAttachmentPath(enterpriseId, input);
    return this.toDocument(await this.documentRecordRepo.save(this.documentRecordRepo.create({ ...this.toDocumentEntityData(input), enterpriseId, status: 1 })));
  }

  async updateDocument(enterpriseId: string, recordId: string, input: EnterpriseWorkspaceDocumentDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const item = await this.requireDocumentRecord(enterpriseId, recordId);
    this.assertDocumentAttachmentPath(enterpriseId, input, item);
    Object.assign(item, this.toDocumentEntityData(input));
    return this.toDocument(await this.documentRecordRepo.save(item));
  }

  async removeDocument(enterpriseId: string, recordId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    await this.documentRecordRepo.remove(await this.requireDocumentRecord(enterpriseId, recordId));
    return null;
  }

  async getGaoxinDocumentPackage(enterpriseId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.getGaoxinDocumentPackageForEnterprise(enterpriseId);
  }

  async adoptGaoxinDocumentPackage(
    enterpriseId: string,
    keys: string[] | undefined,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    return this.clientService.adoptGaoxinDocumentPackageForEnterprise(enterpriseId, keys);
  }

  async createCertificate(enterpriseId: string, input: EnterpriseWorkspaceCertificateDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    this.assertCertificateAttachmentPath(enterpriseId, input);
    return this.toCertificate(await this.certificateRecordRepo.save(this.certificateRecordRepo.create({ ...this.toCertificateEntityData(input), enterpriseId, status: 1 })));
  }

  async updateCertificate(enterpriseId: string, recordId: string, input: EnterpriseWorkspaceCertificateDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const item = await this.requireCertificateRecord(enterpriseId, recordId);
    this.assertCertificateAttachmentPath(enterpriseId, input, item);
    Object.assign(item, this.toCertificateEntityData(input));
    return this.toCertificate(await this.certificateRecordRepo.save(item));
  }

  async removeCertificate(enterpriseId: string, recordId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    await this.certificateRecordRepo.remove(await this.requireCertificateRecord(enterpriseId, recordId));
    return null;
  }

  async removeCertificates(enterpriseId: string, recordIds: string[], user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const ids = [...new Set(recordIds.map(String).filter(Boolean))];
    if (!ids.length) throw new BadRequestException('请选择需要删除的企业证书');
    const items = await this.certificateRecordRepo.find({
      where: { enterpriseId, id: In(ids), status: 1 },
    });
    if (items.length !== ids.length) throw new NotFoundException('部分企业证书不存在或无权访问');
    await this.certificateRecordRepo.remove(items);
    return { deletedCount: items.length };
  }

  async createAccount(enterpriseId: string, input: EnterpriseWorkspaceAccountDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    if (!input.zhPassword?.trim()) throw new BadRequestException('新建企业账号时必须填写密码');
    return this.toAccount(await this.accountRecordRepo.save(this.accountRecordRepo.create({ ...this.toAccountEntityData(input), enterpriseId, status: 1 })));
  }

  async updateAccount(enterpriseId: string, recordId: string, input: EnterpriseWorkspaceAccountDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const item = await this.requireAccountRecord(enterpriseId, recordId);
    const data = this.toAccountEntityData(input);
    const { zhPassword, ...dataWithoutPassword } = data;
    Object.assign(item, input.zhPassword?.trim() ? data : dataWithoutPassword);
    return this.toAccount(await this.accountRecordRepo.save(item));
  }

  async removeAccount(enterpriseId: string, recordId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    await this.accountRecordRepo.remove(await this.requireAccountRecord(enterpriseId, recordId));
    return null;
  }

  async listPhotos(enterpriseId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const items = await this.photoRecordRepo.find({
      where: { enterpriseId, status: 1 },
      order: { updatedAt: 'DESC' },
    });
    return items.map((item) => this.toPhoto(item));
  }

  async createPhoto(
    enterpriseId: string,
    input: EnterpriseWorkspacePhotoDto,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    this.assertPhotoAttachmentPaths(enterpriseId, input);
    return this.toPhoto(
      await this.photoRecordRepo.save(
        this.photoRecordRepo.create({
          ...this.toPhotoEntityData(input),
          enterpriseId,
          status: 1,
        }),
      ),
    );
  }

  async updatePhoto(
    enterpriseId: string,
    photoId: string,
    input: EnterpriseWorkspacePhotoDto,
    user: CurrentUser,
  ) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const item = await this.requirePhotoRecord(enterpriseId, photoId);
    this.assertPhotoAttachmentPaths(enterpriseId, input, item);
    Object.assign(item, this.toPhotoEntityData(input));
    return this.toPhoto(await this.photoRecordRepo.save(item));
  }

  async removePhoto(enterpriseId: string, photoId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    await this.photoRecordRepo.remove(
      await this.requirePhotoRecord(enterpriseId, photoId),
    );
    return null;
  }

  async createFinancialRecord(enterpriseId: string, input: EnterpriseWorkspaceFinancialRecordDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const data = this.toFinancialRecordEntityData(input);
    await this.assertNoActiveFinanceRecordDuplicate(enterpriseId, 'financial', data);
    return this.toFinancialRecord(await this.financeRecordRepo.save(this.financeRecordRepo.create({
      ...data, enterpriseId, recordType: 'financial', status: 1,
    })));
  }

  async updateFinancialRecord(enterpriseId: string, recordId: string, input: EnterpriseWorkspaceFinancialRecordDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const record = await this.financeRecordRepo.findOne({ where: { enterpriseId, id: recordId, recordType: 'financial', status: 1 } });
    if (!record) throw new NotFoundException('财税记录不存在');
    const data = this.toFinancialRecordEntityData(input);
    await this.assertNoActiveFinanceRecordDuplicate(enterpriseId, 'financial', data, record.id);
    Object.assign(record, data);
    return this.toFinancialRecord(await this.financeRecordRepo.save(record));
  }

  async removeFinancialRecord(enterpriseId: string, recordId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const record = await this.financeRecordRepo.findOne({ where: { enterpriseId, id: recordId, recordType: 'financial', status: 1 } });
    if (!record) throw new NotFoundException('财税记录不存在');
    record.status = 0;
    await this.financeRecordRepo.save(record);
    return null;
  }

  async restoreFinancialRecord(enterpriseId: string, recordId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const record = await this.financeRecordRepo.findOne({ where: { enterpriseId, id: recordId, recordType: 'financial', status: 0 } });
    if (!record) throw new NotFoundException('已删除的财税记录不存在');
    await this.assertNoActiveFinanceRecordDuplicate(enterpriseId, 'financial', {
      year: normalizeFinanceYear(record.year),
    }, record.id);
    record.status = 1;
    return this.toFinancialRecord(await this.financeRecordRepo.save(record));
  }

  async createTaxAudit(enterpriseId: string, input: EnterpriseWorkspaceTaxAuditDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    this.assertTaxAuditAttachmentPath(enterpriseId, input);
    const data = this.toTaxAuditEntityData(input);
    await this.assertNoActiveFinanceRecordDuplicate(enterpriseId, 'tax_audit', data);
    return this.toTaxAudit(await this.financeRecordRepo.save(this.financeRecordRepo.create({
      ...data, enterpriseId, recordType: 'tax_audit', status: 1,
    })));
  }

  async updateTaxAudit(enterpriseId: string, recordId: string, input: EnterpriseWorkspaceTaxAuditDto, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const record = await this.financeRecordRepo.findOne({ where: { enterpriseId, id: recordId, recordType: 'tax_audit', status: 1 } });
    if (!record) throw new NotFoundException('纳税审计记录不存在');
    this.assertTaxAuditAttachmentPath(enterpriseId, input, record);
    const data = this.toTaxAuditEntityData(input);
    await this.assertNoActiveFinanceRecordDuplicate(enterpriseId, 'tax_audit', data, record.id);
    Object.assign(record, data);
    return this.toTaxAudit(await this.financeRecordRepo.save(record));
  }

  async removeTaxAudit(enterpriseId: string, recordId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const record = await this.financeRecordRepo.findOne({ where: { enterpriseId, id: recordId, recordType: 'tax_audit', status: 1 } });
    if (!record) throw new NotFoundException('纳税审计记录不存在');
    record.status = 0;
    await this.financeRecordRepo.save(record);
    return null;
  }

  async restoreTaxAudit(enterpriseId: string, recordId: string, user: CurrentUser) {
    await this.assertEnterpriseAccessible(enterpriseId, user);
    const record = await this.financeRecordRepo.findOne({ where: { enterpriseId, id: recordId, recordType: 'tax_audit', status: 0 } });
    if (!record) throw new NotFoundException('已删除的纳税审计记录不存在');
    await this.assertNoActiveFinanceRecordDuplicate(enterpriseId, 'tax_audit', {
      fileClass: record.fileClass,
      taxCategory: record.taxCategory,
      year: normalizeFinanceYear(record.year),
    }, record.id);
    record.status = 1;
    return this.toTaxAudit(await this.financeRecordRepo.save(record));
  }

  private buildRisks(input: {
    declarations: ClientDeclarationEntity[];
    completenessRate: number;
    evidenceBreaks: EvidenceChainBreak[];
    profileStatus: string;
  }): EnterpriseWorkspaceRisk[] {
    const risks: EnterpriseWorkspaceRisk[] = [];

    if (input.profileStatus !== 'completed') {
      risks.push({
        code: 'profile-status',
        description: '企业基础档案尚未完成，需要先确认关键资料。',
        level: 'medium',
        title: '企业档案未完成',
      });
    }
    if (input.completenessRate < 80) {
      risks.push({
        code: 'profile-completeness',
        description: `资料完整度为 ${input.completenessRate.toFixed(0)}%，可能影响项目申报准备。`,
        level: input.completenessRate < 50 ? 'high' : 'medium',
        title: '企业资料待补齐',
      });
    }

    for (const declaration of input.declarations) {
      if (declaration.status === 'rejected') {
        risks.push({
          code: `declaration-rejected-${declaration.id}`,
          description: declaration.rejectedReason ?? '申报已被退回，需要处理补正事项。',
          level: 'high',
          title: `${declaration.projectName} 待补正`,
        });
      } else if (declaration.missingMaterialCount > 0) {
        risks.push({
          code: `declaration-material-${declaration.id}`,
          description: `当前仍缺少 ${declaration.missingMaterialCount} 项申报材料。`,
          level: 'medium',
          title: `${declaration.projectName} 材料不完整`,
        });
      }
    }

    const evidenceBreakCount = input.evidenceBreaks.length;
    if (evidenceBreakCount > 0) {
      risks.push({
        code: 'evidence-chain-breaks',
        description: `IP-RD-PS-成果转化证据链存在 ${evidenceBreakCount} 个断链项，请补齐关联关系。`,
        level: input.evidenceBreaks.some((item) => item.severity === 'high')
          ? 'high'
          : 'medium',
        title: '研发成果证据链不完整',
      });
    }

    return risks;
  }

  private async getEvidenceChainForAccessibleEnterprise(enterpriseId: string) {
    const records = await this.propertyRecordRepo.find({
      order: { updatedAt: 'DESC' },
      where: [
        { enterpriseId, recordType: 'intellectual_property', status: 1 },
        { enterpriseId, recordType: 'research_project', status: 1 },
        { enterpriseId, recordType: 'product_service', status: 1 },
        { enterpriseId, recordType: 'transformation', status: 1 },
      ],
    });
    return this.buildEvidenceChain(records);
  }

  private buildEvidenceChain(records: EnterprisePropertyRecordEntity[]) {
    const ipRows = records.filter(
      (item) => item.recordType === 'intellectual_property',
    );
    const orderedRecords = this.sortWorkspacePropertyRowsByIpCode(
      records,
      ipRows,
    );
    const byType = {
      intellectual_property: orderedRecords.filter((item) => item.recordType === 'intellectual_property'),
      product_service: orderedRecords.filter((item) => item.recordType === 'product_service'),
      research_project: orderedRecords.filter((item) => item.recordType === 'research_project'),
      transformation: orderedRecords.filter((item) => item.recordType === 'transformation'),
    };
    const ids = {
      intellectual_property: new Set(byType.intellectual_property.map((item) => item.id)),
      product_service: new Set(byType.product_service.map((item) => item.id)),
      research_project: new Set(byType.research_project.map((item) => item.id)),
      transformation: new Set(byType.transformation.map((item) => item.id)),
    };
    const validLinks = (value: null | string, target: EvidenceChainDomain) =>
      this.parseRelationIds(value).filter((id) => ids[target].has(id));
    const nodes: EvidenceChainNode[] = [
      ...byType.intellectual_property.map((item) => ({
        code: item.ipCode ?? `IP${item.id}`,
        id: item.id,
        links: {},
        name: item.softWorkName ?? item.ipCode ?? item.id,
        type: 'intellectual_property' as const,
      })),
      ...byType.research_project.map((item) => ({
        code: item.kyProjectNum ?? `RD${item.id}`,
        id: item.id,
        links: { intellectual_property: validLinks(item.relatedIpIds, 'intellectual_property') },
        name: item.kyProjectName ?? item.id,
        type: 'research_project' as const,
      })),
      ...byType.product_service.map((item) => ({
        code: item.psCode ?? `PS${item.id}`,
        id: item.id,
        links: {
          intellectual_property: validLinks(item.relatedIpIds, 'intellectual_property'),
          research_project: validLinks(item.relatedRdIds, 'research_project'),
        },
        name: item.psName ?? item.id,
        type: 'product_service' as const,
      })),
      ...byType.transformation.map((item) => ({
        code: item.transformationCode ?? `成果${item.id}`,
        id: item.id,
        links: {
          intellectual_property: validLinks(item.relatedIpIds, 'intellectual_property'),
          product_service: validLinks(item.relatedPsIds, 'product_service'),
          research_project: validLinks(item.relatedRdIds, 'research_project'),
        },
        name: item.transformationName ?? item.id,
        type: 'transformation' as const,
      })),
    ];
    const breaks: EvidenceChainBreak[] = [];
    const addBreak = (
      node: EvidenceChainNode,
      code: string,
      description: string,
      severity: EvidenceChainBreak['severity'],
      title: string,
    ) => {
      const routeName = {
        intellectual_property: 'EnterpriseWorkspaceProperties',
        product_service: 'EnterpriseWorkspaceProductServices',
        research_project: 'EnterpriseWorkspaceResearch',
        transformation: 'EnterpriseWorkspaceTransformations',
      }[node.type];
      breaks.push({ code, description, nodeId: node.id, nodeName: `${node.code} ${node.name}`, nodeType: node.type, routeName, severity, title });
    };

    const researchNodes = nodes.filter((item) => item.type === 'research_project');
    const productNodes = nodes.filter((item) => item.type === 'product_service');
    const transformationNodes = nodes.filter((item) => item.type === 'transformation');
    for (const node of nodes.filter((item) => item.type === 'intellectual_property')) {
      if (!researchNodes.some((item) => item.links.intellectual_property?.includes(node.id))) {
        addBreak(node, `ip-without-rd-${node.id}`, '尚未关联任何研发项目。', 'medium', '知识产权缺少研发关联');
      }
    }
    for (const node of researchNodes) {
      if (!node.links.intellectual_property?.length) {
        addBreak(node, `rd-without-ip-${node.id}`, '尚未关联有效的知识产权。', 'medium', '研发项目缺少知识产权');
      }
    }
    for (const node of productNodes) {
      const missing = [
        !node.links.intellectual_property?.length ? '知识产权' : '',
        !node.links.research_project?.length ? '研发项目' : '',
      ].filter(Boolean);
      if (missing.length) {
        addBreak(node, `ps-without-evidence-${node.id}`, `缺少关联${missing.join('、')}。`, 'medium', '产品服务证据不完整');
      }
    }
    for (const node of transformationNodes) {
      const missing = [
        !node.links.intellectual_property?.length ? '知识产权' : '',
        !node.links.research_project?.length ? '研发项目' : '',
        !node.links.product_service?.length ? '产品服务' : '',
      ].filter(Boolean);
      if (missing.length) {
        addBreak(node, `transformation-without-evidence-${node.id}`, `缺少关联${missing.join('、')}。`, 'high', '成果转化证据不完整');
      }
    }
    const totalNodeCount = nodes.length;
    return {
      breaks,
      nodes,
      stats: {
        breakCount: breaks.length,
        connectedNodeCount: totalNodeCount - new Set(breaks.map((item) => item.nodeId)).size,
        intellectualPropertyCount: byType.intellectual_property.length,
        productServiceCount: byType.product_service.length,
        researchProjectCount: byType.research_project.length,
        transformationCount: byType.transformation.length,
      },
    };
  }

  private async assertEnterpriseAccessible(
    enterpriseId: string,
    currentUser: CurrentUser,
  ) {
    await this.enterpriseProfileService.detail(enterpriseId, currentUser);
  }

  private async clearDefaultContacts(
    enterpriseId: string,
    excludeContactId?: string,
  ) {
    const contacts = await this.contactRepo.find({
      where: { enterpriseId, isDefault: 1, status: 1 },
    });
    await Promise.all(
      contacts
        .filter((item) => item.id !== excludeContactId)
        .map((item) => {
          item.isDefault = 0;
          return this.contactRepo.save(item);
        }),
    );
  }

  private async requireContact(enterpriseId: string, contactId: string) {
    const contact = await this.contactRepo.findOne({
      where: { enterpriseId, id: contactId, status: 1 },
    });
    if (!contact) {
      throw new NotFoundException('联系人不存在');
    }
    return contact;
  }

  private async requireEmployee(enterpriseId: string, employeeId: string) {
    const employee = await this.employeeRecordRepo.findOne({
      where: { enterpriseId, id: employeeId, status: 1 },
    });
    if (!employee) {
      throw new NotFoundException('员工记录不存在');
    }
    return employee;
  }

  private requireName(value: string) {
    const name = value.trim();
    if (!name) {
      throw new BadRequestException('联系人姓名不能为空');
    }
    return name;
  }

  private toContact(contact: EnterpriseContactEntity) {
    return {
      email: contact.email,
      id: contact.id,
      isDefault: contact.isDefault === 1,
      name: contact.name,
      phone: contact.phone,
      position: contact.position,
      remark: contact.remark,
      roleName: contact.roleName,
    };
  }

  private async requireWorkspaceDeclaration(enterpriseId: string, declarationId: string) {
    const declaration = await this.declarationRepo.findOne({ where: { enterpriseId, id: declarationId } });
    if (!declaration) throw new NotFoundException('申报记录不存在');
    return declaration;
  }

  private toDeclarationWorkspaceItem(item: ClientDeclarationEntity) {
    return {
      currentNodeName: item.currentNodeName,
      deadline: item.deadline,
      id: item.id,
      missingMaterialCount: item.missingMaterialCount,
      progress: item.progress,
      projectId: item.projectId,
      projectName: item.projectName,
      rejectedReason: item.rejectedReason,
      status: item.status,
      updatedAt: item.updatedAt,
    };
  }

  private toDeclarationSummary(item: ClientDeclarationEntity) {
    return {
      currentNodeName: item.currentNodeName,
      deadline: item.deadline,
      id: String(item.id),
      missingMaterialCount: item.missingMaterialCount,
      progress: item.progress,
      projectName: item.projectName,
      rejectedReason: item.rejectedReason,
      status: item.status,
      updatedAt: item.updatedAt,
    };
  }

  private parseSnapshot(value: null | string): Record<string, unknown> {
    if (!value) return {};
    try {
      const result = JSON.parse(value);
      return result && typeof result === 'object' && !Array.isArray(result)
        ? result as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }

  private getFlowNodeExecutionStatus(timeRule?: Record<string, unknown>) {
    const startDate = parseFlowDate(timeRule?.startDate);
    const endDate = parseFlowDate(timeRule?.endDate);
    if (
      timeRule?.mode !== 'date_range'
      || !startDate
      || !endDate
      || startDate > endDate
    ) {
      return 'unconfigured' as const;
    }
    const now = new Date();
    if (now < startDate) return 'pending' as const;
    if (now > endDate) return 'overdue' as const;
    return 'in_progress' as const;
  }

  private parseJsonArray(value: null | string): unknown[] {
    try {
      const parsed = JSON.parse(value ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private getFlowNodes(snapshot: Record<string, unknown>) {
    const scheme = snapshot.scheme as { flowTemplate?: { nodes?: unknown } } | undefined;
    const nodes = Array.isArray(scheme?.flowTemplate?.nodes)
      ? scheme.flowTemplate.nodes
      : [];
    return nodes
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => ({
        code: typeof item.code === 'string' ? item.code : '',
        name: typeof item.name === 'string' ? item.name : '',
        role: typeof item.role === 'string' ? item.role : '',
        type: typeof item.type === 'string' ? item.type : '',
      }))
      .filter((item) => item.name);
  }

  private appendFlowHistory(
    snapshot: Record<string, unknown>,
    item: Record<string, string>,
  ) {
    const history = Array.isArray(snapshot.schemeFlowHistory)
      ? snapshot.schemeFlowHistory.filter((entry) => entry && typeof entry === 'object')
      : [];
    return JSON.stringify({
      ...snapshot,
      schemeFlowHistory: [...history, { ...item, at: new Date().toISOString() }],
    });
  }

  private toNullableString(value: null | string | undefined) {
    const text = value?.trim();
    return text ? text : null;
  }

  private getBasicProfileExtra(
    basicInfo?: EnterpriseBasicInfoEntity | null,
  ): Record<string, unknown> {
    const source = this.parseJsonObject(basicInfo?.extraJson);
    const workspaceExtra = source.workspaceBasicProfile;
    if (workspaceExtra && typeof workspaceExtra === 'object' && !Array.isArray(workspaceExtra)) {
      return workspaceExtra as Record<string, unknown>;
    }

    const clientExtra = source.clientBasicProfile;
    if (!clientExtra || typeof clientExtra !== 'object' || Array.isArray(clientExtra)) {
      return {};
    }
    const value = clientExtra as Record<string, unknown>;
    return {
      companyIntro: value.companyIntro,
      contactFax: value.contacts_fax,
      contactIdCard: value.contacts_idcard,
      contactMobile: value.contacts_mobile,
      isInvest: value.is_invest,
      isIpo: value.is_ipo,
      legalPersonIdCard: value.le_person_idcard,
      legalPersonPhone: value.le_person_phone,
      listedCode: value.listedCode,
      mainAreas: value.main_areas,
      vcAmount: value.vcAmount,
      zipCode: value.zip_code,
    };
  }

  private parseJsonObject(value?: null | string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(value ?? '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private normalizeTextArray(value: unknown): string[] {
    const values = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(/[，,;；\n]/u)
        : [];
    return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
  }

  private toNullableUnknownString(value: unknown): null | string {
    return typeof value === 'string' ? this.toNullableString(value) : null;
  }

  private toNullableNumber(value: unknown): null | number {
    if (value === null || value === undefined || value === '') return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }

  private toNullableNumericString(value: unknown): null | string {
    const numberValue = this.toNullableNumber(value);
    return numberValue === null ? null : String(numberValue);
  }

  private toNullableFlag(value: unknown): 0 | 1 | null {
    if (value === 0 || value === '0' || value === false) return 0;
    if (value === 1 || value === '1' || value === true) return 1;
    return null;
  }

  private formatBasicProfileDate(value?: Date | null): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }

  private parseBasicProfileDate(value: unknown): Date | null {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return null;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private requireBasicProfileText(value: unknown, message: string): string {
    const result = typeof value === 'string' ? value.trim() : '';
    if (!result) throw new BadRequestException(message);
    return result;
  }

  private toBasicProfileShareholder(person: EnterprisePersonEntity) {
    const extra = this.parseJsonObject(person.extraJson);
    return {
      citizenType: this.toNullableNumber(extra.citizen_type) as 1 | 2 | 3 | null,
      id: String(person.id),
      idCard: this.toNullableUnknownString(extra.idcard),
      investMoney: this.toNullableNumber(extra.invest_money),
      name: person.name,
    };
  }

  private async replaceBasicProfileShareholders(
    enterpriseId: string,
    shareholders: EnterpriseWorkspaceBasicProfileDto['shareholders'],
  ) {
    await this.personRepo.delete({ enterpriseId, personType: 'shareholder' });
    const entities = (shareholders ?? [])
      .filter((item) => this.toNullableString(item.name ?? null))
      .map((item) => {
        const name = this.requireBasicProfileText(item.name, '股东姓名不能为空');
        const idCard = this.toNullableString(item.idCard ?? null);
        return this.personRepo.create({
          enterpriseId,
          extraJson: JSON.stringify({
            citizen_type: [1, 2, 3].includes(Number(item.citizenType))
              ? Number(item.citizenType)
              : 1,
            idcard: idCard,
            invest_money: this.toNullableNumber(item.investMoney),
          }),
          isLegalPerson: 0,
          name,
          personType: 'shareholder',
          phone: null,
          position: `股东:${idCard ?? name}`,
          source: 'workspace_basic_profile',
        });
      });
    if (entities.length) await this.personRepo.save(entities);
  }

  private async upsertWorkspaceDefaultContact(
    enterpriseId: string,
    input: { email: null | string; name: null | string; phone: null | string },
  ) {
    if (!input.name && !input.phone && !input.email) return;
    const contact = await this.contactRepo.findOne({
      order: { isDefault: 'DESC', id: 'ASC' },
      where: { enterpriseId, status: 1 },
    });
    if (contact) {
      contact.email = input.email;
      contact.name = input.name ?? contact.name;
      contact.phone = input.phone;
      contact.isDefault = 1;
      await this.clearDefaultContacts(enterpriseId, contact.id);
      await this.contactRepo.save(contact);
      return;
    }
    await this.contactRepo.save(this.contactRepo.create({
      email: input.email,
      enterpriseId,
      isDefault: 1,
      name: input.name ?? '企业联系人',
      phone: input.phone,
      status: 1,
    }));
  }

  private async getAttachmentPaths(
    enterpriseId: string,
    attachmentType: EnterpriseWorkspaceAttachmentType,
    recordId: string,
  ): Promise<string[]> {
    let value: null | string = null;

    if (attachmentType === 'tax-audit') {
      const item = await this.financeRecordRepo.findOne({
        where: { enterpriseId, id: recordId, recordType: 'tax_audit', status: 1 },
      });
      value = item?.filePath ?? null;
    } else if (attachmentType === 'contract') {
      value = (await this.requireContractRecord(enterpriseId, recordId, 'contract', '合同')).htPath;
    } else if (attachmentType === 'invoice') {
      value = (await this.requireContractRecord(enterpriseId, recordId, 'invoice', '发票')).fpPath;
    } else if (attachmentType === 'document') {
      value = (await this.requireDocumentRecord(enterpriseId, recordId)).filePath;
    } else if (attachmentType === 'certificate') {
      value = (await this.requireCertificateRecord(enterpriseId, recordId)).zsPath;
    } else if (attachmentType === 'photo') {
      value = (await this.requirePhotoRecord(enterpriseId, recordId)).photoFiles;
    } else if (attachmentType === 'employee') {
      const item = await this.requireEmployee(enterpriseId, recordId);
      value = [item.ygFiles, item.laborContractFile, item.socialSecurityFile, item.educationFile, item.titleFile]
        .filter((item): item is string => Boolean(item))
        .join(',');
    } else if (attachmentType === 'intellectual_property') {
      const item = await this.propertyRecordRepo.findOne({
        where: { enterpriseId, id: recordId, recordType: 'intellectual_property', status: 1 },
      });
      value = item?.softWorkFile ?? null;
    }

    if (value === null) {
      throw new NotFoundException('附件记录不存在');
    }

    return value
      .split(/[\n,;]+/u)
      .map((item) => normalizeStoredUploadPath(item))
      .filter((item): item is string => Boolean(item));
  }

  private getAttachmentContentType(filename: string): string {
    const types: Record<string, string> = {
      '.gif': 'image/gif',
      '.jpeg': 'image/jpeg',
      '.jpg': 'image/jpeg',
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain; charset=utf-8',
      '.webp': 'image/webp',
    };
    return types[extname(filename).toLowerCase()] ?? 'application/octet-stream';
  }

  private parseJsonStringArray(value: null | string): string[] {
    if (!value) return [];
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }

  private getQueryValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }

  private toTaxAudit(item: EnterpriseFinanceRecordEntity) {
    return {
      fileClass: item.fileClass,
      filePath: item.filePath,
      id: item.id,
      remark: item.remark,
      status: item.status,
      taxCategory: item.taxCategory,
      year: item.year,
    };
  }

  private toTaxAuditEntityData(input: EnterpriseWorkspaceTaxAuditDto) {
    return {
      fileClass: normalizeFinanceFileClass(input.fileClass),
      filePath: this.toNullableString(input.filePath),
      remark: this.toNullableString(input.remark),
      taxCategory: normalizeFinanceTaxCategory(input.taxCategory),
      year: normalizeFinanceYear(input.year),
    };
  }

  private async requireContractRecord(enterpriseId: string, recordId: string, recordType: 'contract' | 'invoice', label: string) {
    const item = await this.contractRecordRepo.findOne({ where: { enterpriseId, id: recordId, recordType, status: 1 } });
    if (!item) throw new NotFoundException(`${label}记录不存在`);
    return item;
  }

  private async requireDocumentRecord(enterpriseId: string, recordId: string) {
    const item = await this.documentRecordRepo.findOne({ where: { enterpriseId, id: recordId, status: 1 } });
    if (!item) throw new NotFoundException('制度文件不存在');
    return item;
  }

  private async requireCertificateRecord(enterpriseId: string, recordId: string) {
    const item = await this.certificateRecordRepo.findOne({ where: { enterpriseId, id: recordId, status: 1 } });
    if (!item) throw new NotFoundException('企业证书不存在');
    return item;
  }

  private async requirePhotoRecord(enterpriseId: string, photoId: string) {
    const item = await this.photoRecordRepo.findOne({
      where: { enterpriseId, id: photoId, status: 1 },
    });
    if (!item) throw new NotFoundException('企业照片不存在');
    return item;
  }

  private async requireAccountRecord(enterpriseId: string, recordId: string) {
    const item = await this.accountRecordRepo.findOne({ where: { enterpriseId, id: recordId, status: 1 } });
    if (!item) throw new NotFoundException('企业账号不存在');
    return item;
  }

  private toContract(item: EnterpriseContractRecordEntity) {
    return { endDate: item.endDate, htDes: item.htDes, htMoney: item.htMoney, htName: item.htName, htNum: item.htNum, htPath: item.htPath, htStatus: item.htStatus, id: item.id, khName: item.khName, qdDate: item.qdDate, startDate: item.startDate };
  }

  private toContractEntityData(input: EnterpriseWorkspaceContractDto) {
    const htName = input.htName.trim();
    if (!htName) throw new BadRequestException('合同名称不能为空');
    return { endDate: this.toNullableString(input.endDate), htDes: this.toNullableString(input.htDes), htMoney: this.toNullableString(input.htMoney), htName, htNum: this.toNullableString(input.htNum), htPath: this.toNullableString(input.htPath), htStatus: input.htStatus ?? null, khName: this.toNullableString(input.khName), qdDate: this.toNullableString(input.qdDate), startDate: this.toNullableString(input.startDate) };
  }

  private toInvoice(item: EnterpriseContractRecordEntity) {
    return { fpDate: item.fpDate, fpMoney: item.fpMoney, fpNum: item.fpNum, fpPath: item.fpPath, fpStatus: item.fpStatus, htId: item.htId, id: item.id, remark: item.remark, zfDate: item.zfDate };
  }

  private async toInvoiceEntityData(enterpriseId: string, input: EnterpriseWorkspaceInvoiceDto) {
    const fpNum = input.fpNum.trim();
    if (!fpNum) throw new BadRequestException('发票号码不能为空');
    const htId = this.toNullableString(input.htId);
    if (htId) await this.requireContractRecord(enterpriseId, htId, 'contract', '关联合同');
    return { fpDate: this.toNullableString(input.fpDate), fpMoney: this.toNullableString(input.fpMoney), fpNum, fpPath: this.toNullableString(input.fpPath), fpStatus: input.fpStatus ?? null, htId, remark: this.toNullableString(input.remark), zfDate: this.toNullableString(input.zfDate) };
  }

  private toDocument(item: EnterpriseDocumentRecordEntity) {
    return { fileClass: item.fileClass, filePath: item.filePath, fileRemark: item.fileRemark, fileStartDate: item.fileStartDate, fileStatus: item.fileStatus, fileTitle: item.fileTitle, fileVersion: item.fileVersion, id: item.id };
  }

  private toDocumentEntityData(input: EnterpriseWorkspaceDocumentDto) {
    const fileTitle = input.fileTitle.trim();
    if (!fileTitle) throw new BadRequestException('制度文件名称不能为空');
    return { fileClass: input.fileClass ?? null, filePath: this.toNullableString(input.filePath), fileRemark: this.toNullableString(input.fileRemark), fileStartDate: this.toNullableString(input.fileStartDate), fileStatus: input.fileStatus ?? null, fileTitle, fileVersion: this.toNullableString(input.fileVersion) };
  }

  private toCertificate(item: EnterpriseCertificateRecordEntity) {
    return { id: item.id, qualificationCode: item.qualificationCode, validUntil: item.validUntil ? item.validUntil.toISOString().slice(0, 10) : null, zsClass: item.zsClass, zsName: item.zsName, zsPath: item.zsPath };
  }

  private toCertificateEntityData(input: EnterpriseWorkspaceCertificateDto) {
    const zsName = input.zsName.trim();
    if (!isEnterpriseCertificateType(input.qualificationCode)) {
      throw new BadRequestException('请选择固定证书类型');
    }
    if (!zsName) throw new BadRequestException('证书名称不能为空');
    const validUntil = this.toNullableString(input.validUntil);
    return { qualificationCode: this.toNullableString(input.qualificationCode), validUntil: validUntil ? new Date(`${validUntil}T00:00:00.000Z`) : null, zsClass: input.zsClass ?? null, zsName, zsPath: this.toNullableString(input.zsPath) };
  }

  private toPhoto(item: EnterprisePhotoRecordEntity) {
    return {
      id: item.id,
      photoDes: item.photoDes,
      photoFiles: item.photoFiles,
      photoStatus: item.photoStatus,
      photoTitle: item.photoTitle,
      psDate: item.psDate,
      updatedAt: item.updatedAt,
    };
  }

  private toPhotoEntityData(input: EnterpriseWorkspacePhotoDto) {
    const photoTitle = input.photoTitle.trim();
    const photoFiles = input.photoFiles.trim();
    if (!photoTitle || !photoFiles) {
      throw new BadRequestException('照片标题和文件不能为空');
    }
    return {
      photoDes: this.toNullableString(input.photoDes),
      photoFiles,
      photoStatus: input.photoStatus ?? null,
      photoTitle,
      psDate: this.toNullableString(input.psDate),
    };
  }

  private toAccount(item: EnterpriseAccountRecordEntity) {
    return { bEmail: item.bEmail, bPhone: item.bPhone, charge: item.charge, endDate: item.endDate, gsbm: item.gsbm, hasPassword: Boolean(item.zhPassword), id: item.id, ptName: item.ptName, ptUrl: item.ptUrl, remark: item.remark, zhNumber: item.zhNumber, zhStatus: item.zhStatus, zhType: item.zhType };
  }

  private toAccountEntityData(input: EnterpriseWorkspaceAccountDto) {
    const ptName = input.ptName.trim();
    const zhNumber = input.zhNumber.trim();
    if (!ptName || !zhNumber) throw new BadRequestException('平台名称和账号不能为空');
    return { bEmail: this.toNullableString(input.bEmail), bPhone: this.toNullableString(input.bPhone), charge: this.toNullableString(input.charge), endDate: this.toNullableString(input.endDate), gsbm: this.toNullableString(input.gsbm), ptName, ptUrl: this.toNullableString(input.ptUrl), remark: this.toNullableString(input.remark), zhNumber, zhPassword: this.toNullableString(input.zhPassword), zhStatus: input.zhStatus ?? null, zhType: input.zhType ?? null };
  }

  private toFinancialRecord(item: EnterpriseFinanceRecordEntity) {
    return { fz: item.fz, fzl: item.fzl, highTechIncome: item.highTechIncome, id: item.id, lrTotal: item.lrTotal, mainBusinessIncome: item.mainBusinessIncome, netAssets: item.netAssets, netProfit: item.netProfit, q: item.q, rdDepreciation: item.rdDepreciation, rdDesignFee: item.rdDesignFee, rdDirectInput: item.rdDirectInput, rdEntrustedDevelopment: item.rdEntrustedDevelopment, rdEquipmentDebuggingFee: item.rdEquipmentDebuggingFee, rdExpense: item.yffy, rdIntangibleAmortization: item.rdIntangibleAmortization, rdOtherExpense: item.rdOtherExpense, rdPersonnelCost: item.rdPersonnelCost, remark: item.remark, status: item.status, totalRevenue: item.totalRevenue, xxsr: item.xxsr, year: item.year, zxc: item.zxc };
  }

  private toFinancialRecordEntityData(input: EnterpriseWorkspaceFinancialRecordDto) {
    return { fz: normalizeFinanceAmount(input.fz), fzl: this.toNullableString(input.fzl), highTechIncome: normalizeFinanceAmount(input.highTechIncome), lrTotal: normalizeFinanceAmount(input.lrTotal), mainBusinessIncome: normalizeFinanceAmount(input.mainBusinessIncome), netAssets: normalizeFinanceAmount(input.netAssets), netProfit: normalizeFinanceAmount(input.netProfit), q: 1, rdDepreciation: normalizeFinanceAmount(input.rdDepreciation), rdDesignFee: normalizeFinanceAmount(input.rdDesignFee), rdDirectInput: normalizeFinanceAmount(input.rdDirectInput), rdEntrustedDevelopment: normalizeFinanceAmount(input.rdEntrustedDevelopment), rdEquipmentDebuggingFee: normalizeFinanceAmount(input.rdEquipmentDebuggingFee), rdIntangibleAmortization: normalizeFinanceAmount(input.rdIntangibleAmortization), rdOtherExpense: normalizeFinanceAmount(input.rdOtherExpense), rdPersonnelCost: normalizeFinanceAmount(input.rdPersonnelCost), remark: this.toNullableString(input.remark), totalRevenue: normalizeFinanceAmount(input.totalRevenue), year: normalizeFinanceYear(input.year), xxsr: normalizeFinanceAmount(input.xxsr), yffy: normalizeFinanceAmount(input.rdExpense), zxc: normalizeFinanceAmount(input.zxc) };
  }

  private async assertNoActiveFinanceRecordDuplicate(
    enterpriseId: string,
    recordType: 'financial' | 'tax_audit',
    data: {
      fileClass?: null | number;
      taxCategory?: null | string;
      year: string;
    },
    currentId?: string,
  ) {
    const record = await this.financeRecordRepo.findOne({
      where: recordType === 'financial'
        ? { enterpriseId, recordType, status: 1, year: data.year }
        : { enterpriseId, fileClass: data.fileClass ?? IsNull(), recordType, status: 1, taxCategory: data.taxCategory ?? IsNull(), year: data.year },
    });
    if (record && record.id !== currentId) {
      throw new BadRequestException(recordType === 'financial'
        ? `${data.year} 年度财务数据已存在，请编辑现有记录`
        : `${data.year} 年度相同文件类型和报告类别的纳税审计记录已存在，请编辑现有记录`);
    }
  }

  private toEmployee(employee: EnterpriseEmployeeRecordEntity) {
    return {
      annualWorkDays: employee.annualWorkDays,
      department: employee.department,
      educationFile: employee.educationFile,
      entryDate: employee.entryDate,
      id: employee.id,
      idCard: employee.idCard,
      isActive: employee.isActive !== 0,
      isKjyf: employee.isKjyf === 1,
      laborContractFile: employee.laborContractFile,
      position: employee.position,
      rdProjects: employee.rdProjects,
      remark: employee.remark,
      socialSecurityFile: employee.socialSecurityFile,
      titleFile: employee.titleFile,
      ygFiles: employee.ygFiles,
      ygLx: employee.ygLx,
      ygLxgg: employee.ygLxgg === 1,
      ygName: employee.ygName,
      ygNl: employee.ygNl,
      ygQr: employee.ygQr === 1,
      ygSex: employee.ygSex,
      ygWj: employee.ygWj === 1,
      ygXl: employee.ygXl,
      ygZc: employee.ygZc,
    };
  }

  private async assertEmployeeAttachmentPaths(
    enterpriseId: string,
    input: EnterpriseWorkspaceEmployeeDto,
    current?: EnterpriseEmployeeRecordEntity,
  ) {
    const fields = ['educationFile', 'laborContractFile', 'socialSecurityFile', 'titleFile', 'ygFiles'] as const;
    for (const field of fields) {
      const path = normalizeStoredUploadPath(input[field]);
      if (!path) continue;
      const existingPath = normalizeStoredUploadPath(current?.[field]);
      if (path === existingPath || this.isEmployeeAttachmentPathForEnterprise(enterpriseId, path)) continue;
      throw new BadRequestException('员工附件必须通过当前企业材料台账上传');
    }
  }

  private async assertArchiveAttachmentPaths(
    enterpriseId: string,
    input: EnterpriseWorkspaceContractDto | EnterpriseWorkspaceInvoiceDto,
    current?: EnterpriseContractRecordEntity,
  ) {
    const attachmentPath = (input as EnterpriseWorkspaceContractDto).htPath
      ?? (input as EnterpriseWorkspaceInvoiceDto).fpPath;
    const path = normalizeStoredUploadPath(attachmentPath);
    if (!path) return;
    const currentPath = normalizeStoredUploadPath(current?.recordType === 'contract' ? current.htPath : current?.fpPath);
    if (path === currentPath || this.isEmployeeAttachmentPathForEnterprise(enterpriseId, path)) return;
    throw new BadRequestException('合同和发票附件必须通过当前企业材料台账上传');
  }

  private assertTaxAuditAttachmentPath(
    enterpriseId: string,
    input: EnterpriseWorkspaceTaxAuditDto,
    current?: EnterpriseFinanceRecordEntity,
  ) {
    this.assertAttachmentPathForEnterprise(enterpriseId, input.filePath, current?.filePath, '纳税审计附件');
  }

  private assertDocumentAttachmentPath(
    enterpriseId: string,
    input: EnterpriseWorkspaceDocumentDto,
    current?: EnterpriseDocumentRecordEntity,
  ) {
    this.assertAttachmentPathForEnterprise(enterpriseId, input.filePath, current?.filePath, '制度文件附件');
  }

  private assertCertificateAttachmentPath(
    enterpriseId: string,
    input: EnterpriseWorkspaceCertificateDto,
    current?: EnterpriseCertificateRecordEntity,
  ) {
    this.assertAttachmentPathForEnterprise(enterpriseId, input.zsPath, current?.zsPath, '企业证书附件');
  }

  private assertPhotoAttachmentPaths(
    enterpriseId: string,
    input: EnterpriseWorkspacePhotoDto,
    current?: EnterprisePhotoRecordEntity,
  ) {
    const currentPaths = new Set(
      String(current?.photoFiles ?? '')
        .split(/[\n,;]+/u)
        .map((value) => normalizeStoredUploadPath(value))
        .filter((value): value is string => Boolean(value)),
    );
    for (const value of input.photoFiles.split(/[\n,;]+/u)) {
      const path = normalizeStoredUploadPath(value);
      if (!path || currentPaths.has(path) || this.isEmployeeAttachmentPathForEnterprise(enterpriseId, path)) continue;
      throw new BadRequestException('企业照片附件必须通过当前企业材料台账上传');
    }
  }

  private assertAttachmentPathForEnterprise(
    enterpriseId: string,
    value: null | string | undefined,
    currentValue: null | string | undefined,
    label: string,
  ) {
    const path = normalizeStoredUploadPath(value);
    if (!path) return;
    if (path === normalizeStoredUploadPath(currentValue) || this.isEmployeeAttachmentPathForEnterprise(enterpriseId, path)) return;
    throw new BadRequestException(`${label}必须通过当前企业材料台账上传`);
  }

  private isEmployeeAttachmentPathForEnterprise(enterpriseId: string, path: string) {
    const segments = path.split('/');
    return segments.length >= 6
      && segments[0] === 'enterprise'
      && segments[1] === 'attachment'
      && /^\d{4}$/u.test(segments[2])
      && /^\d{2}$/u.test(segments[3])
      && segments[4] === enterpriseId;
  }

  private async assertEmployeeIdCardUnique(
    enterpriseId: string,
    idCard: null | string,
    currentEmployeeId?: string,
  ): Promise<void> {
    if (!idCard) {
      return;
    }
    const builder = this.employeeRecordRepo
      .createQueryBuilder('employee')
      .where('employee.enterpriseId = :enterpriseId', { enterpriseId })
      .andWhere('employee.idCard = :idCard', { idCard })
      .andWhere('employee.status = :status', { status: 1 });
    if (currentEmployeeId) {
      builder.andWhere('employee.id != :currentEmployeeId', {
        currentEmployeeId,
      });
    }
    if (await builder.getExists()) {
      throw new BadRequestException('该身份证号已存在于当前企业员工名册中');
    }
  }

  private toEmployeeEntityData(input: EnterpriseWorkspaceEmployeeDto) {
    const name = input.ygName.trim();
    if (!name) {
      throw new BadRequestException('员工姓名不能为空');
    }
    const idCard = normalizeChineseIdCard(input.idCard);
    if (idCard && !/^[0-9A-Z]{6,32}$/u.test(idCard)) {
      throw new BadRequestException('身份证号或证件号码格式不正确');
    }
    const identity = /^\d{17}[\dX]$/u.test(idCard ?? '')
      ? parseChineseIdCard(idCard)
      : null;
    if (idCard && /^\d{17}[\dX]$/u.test(idCard) && !identity) {
      throw new BadRequestException('身份证号出生日期或校验位不正确');
    }
    const entryDate = this.toNullableString(input.entryDate);
    if (entryDate && !this.isValidDateOnly(entryDate)) {
      throw new BadRequestException('入职日期格式不正确，请使用 YYYY-MM-DD');
    }
    return {
      annualWorkDays: input.annualWorkDays ?? null,
      department: this.toNullableString(input.department),
      educationFile: this.toNullableString(input.educationFile),
      entryDate,
      idCard,
      isActive: input.isActive === false ? 0 : 1,
      isKjyf: input.isKjyf ? 1 : 0,
      laborContractFile: this.toNullableString(input.laborContractFile),
      position: this.toNullableString(input.position),
      rdProjects: this.toNullableString(input.rdProjects),
      remark: this.toNullableString(input.remark),
      socialSecurityFile: this.toNullableString(input.socialSecurityFile),
      titleFile: this.toNullableString(input.titleFile),
      ygFiles: this.toNullableString(input.ygFiles),
      ygLx: input.ygLx ?? 1,
      ygLxgg: input.ygLxgg ? 1 : 0,
      ygName: name,
      ygNl: identity?.ageRange ?? input.ygNl ?? null,
      ygQr: input.ygQr ? 1 : 0,
      ygSex: identity?.gender ?? input.ygSex ?? null,
      ygWj: input.ygWj ? 1 : 0,
      ygXl: input.ygXl ?? null,
      ygZc: input.ygZc ?? null,
    };
  }

  private isValidDateOnly(value: string): boolean {
    const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
    if (!matched) {
      return false;
    }
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const day = Number(matched[3]);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day;
  }

  private toIntellectualProperty(item: EnterprisePropertyRecordEntity) {
    return { advancedDegree: item.advancedDegree, applyDate: item.applyDate, authorizeDate: item.authorizeDate, id: item.id, inventor: item.inventor, ipCode: item.ipCode, ipLevel: item.ipLevel, isCoreIp: item.isCoreIp === 1, obtainMethod: item.obtainMethod, relatedPsIds: this.parseRelationIds(item.relatedPsIds), relatedRdIds: this.parseRelationIds(item.relatedRdIds), relatedTransformationIds: this.parseRelationIds(item.relatedTransformationIds), remark: item.remark, rightHolder: item.rightHolder, softWorkFile: item.softWorkFile, softWorkName: item.softWorkName, softWorkNum: item.softWorkNum, softWorkStatus: item.softWorkStatus, softWorkType: item.softWorkType, supportEffect: item.supportEffect };
  }

  private sortWorkspacePropertyRowsByIpCode(
    rows: EnterprisePropertyRecordEntity[],
    ipRows: EnterprisePropertyRecordEntity[],
  ): EnterprisePropertyRecordEntity[] {
    const ipRanks = new Map(
      ipRows.map((row) => [String(row.id), this.resolveWorkspaceIpCodeRank(row.ipCode)]),
    );
    const rowIpRank = (row: EnterprisePropertyRecordEntity) => {
      if (row.recordType === 'intellectual_property') {
        return this.resolveWorkspaceIpCodeRank(row.ipCode);
      }
      const ranks = this.parseRelationIds(row.relatedIpIds)
        .map((id) => ipRanks.get(id))
        .filter((rank): rank is number => rank !== undefined);
      return ranks.length > 0 ? Math.min(...ranks) : Number.MAX_SAFE_INTEGER;
    };
    const rowCode = (row: EnterprisePropertyRecordEntity) => {
      if (row.recordType === 'intellectual_property') return row.ipCode ?? '';
      if (row.recordType === 'research_project') return row.kyProjectNum ?? '';
      if (row.recordType === 'product_service') return row.psCode ?? '';
      return row.transformationCode ?? '';
    };

    return [...rows].sort((left, right) => {
      const rankDiff = rowIpRank(left) - rowIpRank(right);
      if (rankDiff !== 0) return rankDiff;
      return rowCode(left).localeCompare(rowCode(right), 'zh-CN', { numeric: true })
        || String(left.id).localeCompare(String(right.id), 'zh-CN', { numeric: true });
    });
  }

  private resolveWorkspaceIpCodeRank(value: null | string | undefined): number {
    const match = String(value ?? '').trim().match(/^IP(\d+)$/iu);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  }

  private toIntellectualPropertyEntityData(input: EnterpriseWorkspaceIntellectualPropertyDto) {
    const name = input.softWorkName.trim();
    if (!name) throw new BadRequestException('知识产权名称不能为空');
    return { advancedDegree: this.toNullableString(input.advancedDegree), applyDate: this.toNullableString(input.applyDate), authorizeDate: this.toNullableString(input.authorizeDate), inventor: this.toNullableString(input.inventor), ipLevel: this.toNullableString(input.ipLevel), isCoreIp: input.isCoreIp ? 1 : 0, obtainMethod: this.toNullableString(input.obtainMethod), relatedPsIds: JSON.stringify(input.relatedPsIds ?? []), relatedRdIds: JSON.stringify(input.relatedRdIds ?? []), relatedTransformationIds: JSON.stringify(input.relatedTransformationIds ?? []), remark: this.toNullableString(input.remark), rightHolder: this.toNullableString(input.rightHolder), softWorkFile: this.toNullableString(input.softWorkFile), softWorkName: name, softWorkNum: this.toNullableString(input.softWorkNum), softWorkStatus: input.softWorkStatus ?? null, softWorkType: input.softWorkType ?? null, supportEffect: this.toNullableString(input.supportEffect) };
  }
  private toResearchProject(item: EnterprisePropertyRecordEntity) { return { coreTechnology: item.coreTechnology, endDate: item.endDate, fundAmount: item.fundAmount, fundSource: item.fundSource, id: item.id, initDate: item.initDate, innovationPoints: item.innovationPoints, kyProjectDes: item.kyProjectDes, kyProjectLeader: item.kyProjectLeader, kyProjectName: item.kyProjectName, kyProjectNum: item.kyProjectNum, kyProjectStatus: item.kyProjectStatus, lxbgFile: item.lxbgFile, projectType: item.projectType, rdBudget: item.rdBudget, rdExpenseTotal: item.rdExpenseTotal, rdOrganizationMethod: item.rdOrganizationMethod, relatedIpIds: this.parseRelationIds(item.relatedIpIds), relatedPsIds: this.parseRelationIds(item.relatedPsIds), relatedTransformationIds: this.parseRelationIds(item.relatedTransformationIds), remark: item.remark, stageResult: item.stageResult }; }
  private toResearchProjectEntityData(input: EnterpriseWorkspaceResearchProjectDto) { const name = input.kyProjectName.trim(); if (!name) throw new BadRequestException('研发项目名称不能为空'); return { coreTechnology: this.toNullableString(input.coreTechnology), endDate: this.toNullableString(input.endDate), fundAmount: this.toNullableString(input.fundAmount), fundSource: input.fundSource ?? null, initDate: this.toNullableString(input.initDate), innovationPoints: this.toNullableString(input.innovationPoints), kyProjectDes: this.toNullableString(input.kyProjectDes), kyProjectLeader: this.toNullableString(input.kyProjectLeader), kyProjectName: name, kyProjectNum: this.toNullableString(input.kyProjectNum), kyProjectStatus: input.kyProjectStatus ?? null, lxbgFile: this.toNullableString(input.lxbgFile), projectType: this.toNullableString(input.projectType), rdBudget: this.toNullableString(input.rdBudget), rdExpenseTotal: this.toNullableString(input.rdExpenseTotal), rdOrganizationMethod: this.toNullableString(input.rdOrganizationMethod), relatedIpIds: JSON.stringify((input.relatedIpIds ?? []).map(String)), relatedPsIds: JSON.stringify((input.relatedPsIds ?? []).map(String)), relatedTransformationIds: JSON.stringify((input.relatedTransformationIds ?? []).map(String)), remark: this.toNullableString(input.remark), stageResult: this.toNullableString(input.stageResult) }; }
  private parseRelationIds(value: null | string): string[] { try { const parsed = JSON.parse(value ?? '[]'); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; } }
  private normalizeTransformationName(value: null | string | undefined): string { const name = String(value ?? '').replace(/^成果\d+\s*[-—_:：]\s*/u, '').trim(); if (!name || /^成果\d+$/u.test(name)) return '未命名技术成果'; return name; }
  private normalizePropertyName(value: string): string { return value.normalize('NFKC').replace(/[（）]/gu, '(').replace(/\s+/gu, ' ').trim().toLocaleLowerCase(); }
  private async assertPropertyNameUnique(enterpriseId: string, recordType: 'product_service' | 'research_project' | 'transformation', name: string, excludeId?: string) { const target = this.normalizePropertyName(name); const rows = await this.propertyRecordRepo.find({ where: { enterpriseId, recordType, status: 1 } }); const duplicate = rows.some((row) => String(row.id) !== String(excludeId ?? '') && this.normalizePropertyName(recordType === 'research_project' ? row.kyProjectName ?? '' : recordType === 'product_service' ? row.psName ?? '' : row.transformationName ?? '') === target); if (duplicate) throw new BadRequestException('名称已存在，请修改后再保存'); }
  private toProductService(item: EnterprisePropertyRecordEntity) { return { competitiveAdvantage: item.competitiveAdvantage, highTechIncome: item.highTechIncome, id: item.id, lastYearIncome: item.lastYearIncome, proofFiles: item.proofFiles, psCode: item.psCode, psName: item.psName, relatedContractIds: this.parseRelationIds(item.relatedContractIds), relatedInvoiceIds: this.parseRelationIds(item.relatedInvoiceIds), relatedIpIds: this.parseRelationIds(item.relatedIpIds), relatedRdIds: this.parseRelationIds(item.relatedRdIds), relatedTransformationIds: this.parseRelationIds(item.relatedTransformationIds), remark: item.remark, techDescription: item.techDescription, techField: item.techField, techIndex: item.techIndex, techSource: item.techSource }; }
  private toProductServiceEntityData(input: EnterpriseWorkspaceProductServiceDto) { const name = input.psName.trim(); if (!name) throw new BadRequestException('产品服务名称不能为空'); return { competitiveAdvantage: this.toNullableString(input.competitiveAdvantage), highTechIncome: this.toNullableString(input.highTechIncome), lastYearIncome: this.toNullableString(input.lastYearIncome), proofFiles: this.toNullableString(input.proofFiles), psCode: this.toNullableString(input.psCode), psName: name, relatedContractIds: JSON.stringify(input.relatedContractIds ?? []), relatedInvoiceIds: JSON.stringify(input.relatedInvoiceIds ?? []), relatedIpIds: JSON.stringify(input.relatedIpIds ?? []), relatedRdIds: JSON.stringify(input.relatedRdIds ?? []), relatedTransformationIds: JSON.stringify(input.relatedTransformationIds ?? []), remark: this.toNullableString(input.remark), techDescription: this.toNullableString(input.techDescription), techField: this.toNullableString(input.techField), techIndex: this.toNullableString(input.techIndex), techSource: this.toNullableString(input.techSource) }; }
  private toTransformation(item: EnterprisePropertyRecordEntity) { return { applicationScene: item.applicationScene, customerName: item.customerName, id: item.id, proofFiles: item.proofFiles, relatedContractIds: this.parseRelationIds(item.relatedContractIds), relatedInvoiceIds: this.parseRelationIds(item.relatedInvoiceIds), relatedIpIds: this.parseRelationIds(item.relatedIpIds), relatedPsIds: this.parseRelationIds(item.relatedPsIds), relatedRdIds: this.parseRelationIds(item.relatedRdIds), remark: item.remark, transformationCode: item.transformationCode, transformationIncome: item.transformationIncome, transformationMethod: item.transformationMethod, transformationName: item.transformationName }; }
  private toTransformationEntityData(input: EnterpriseWorkspaceTransformationDto) { const name = input.transformationName.trim(); if (!name) throw new BadRequestException('成果转化名称不能为空'); return { applicationScene: this.toNullableString(input.applicationScene), customerName: this.toNullableString(input.customerName), proofFiles: this.toNullableString(input.proofFiles), relatedContractIds: JSON.stringify(input.relatedContractIds ?? []), relatedInvoiceIds: JSON.stringify(input.relatedInvoiceIds ?? []), relatedIpIds: JSON.stringify(input.relatedIpIds ?? []), relatedPsIds: JSON.stringify(input.relatedPsIds ?? []), relatedRdIds: JSON.stringify(input.relatedRdIds ?? []), remark: this.toNullableString(input.remark), transformationCode: this.toNullableString(input.transformationCode), transformationIncome: this.toNullableString(input.transformationIncome), transformationMethod: this.toNullableString(input.transformationMethod), transformationName: name }; }

  private async assertPropertyRelationsBelongToEnterprise(
    enterpriseId: string,
    input: {
      relatedContractIds?: string[];
      relatedInvoiceIds?: string[];
      relatedIpIds?: string[];
      relatedPsIds?: string[];
      relatedRdIds?: string[];
      relatedTransformationIds?: string[];
    },
  ): Promise<void> {
    const propertyRelations: Array<[string[] | undefined, string, string]> = [
      [input.relatedIpIds, 'intellectual_property', '知识产权'],
      [input.relatedRdIds, 'research_project', '研发项目'],
      [input.relatedPsIds, 'product_service', '产品服务'],
      [input.relatedTransformationIds, 'transformation', '成果转化'],
    ];
    for (const [ids, recordType, label] of propertyRelations) {
      await this.assertRelationRecordsBelongToEnterprise(enterpriseId, ids, recordType, label);
    }
    await this.assertRelationRecordsBelongToEnterprise(enterpriseId, input.relatedContractIds, 'contract', '合同');
    await this.assertRelationRecordsBelongToEnterprise(enterpriseId, input.relatedInvoiceIds, 'invoice', '发票');
  }

  private async assertRelationRecordsBelongToEnterprise(
    enterpriseId: string,
    ids: string[] | undefined,
    recordType: string,
    label: string,
  ): Promise<void> {
    const normalizedIds = [...new Set((ids ?? []).map(String).filter(Boolean))];
    if (normalizedIds.length === 0) return;
    const repository = ['contract', 'invoice'].includes(recordType)
      ? this.contractRecordRepo
      : this.propertyRecordRepo;
    const rows = await repository.find({
      where: { enterpriseId, id: In(normalizedIds), recordType, status: 1 },
    });
    if (rows.length !== normalizedIds.length) {
      throw new BadRequestException(`关联${label}不存在或不属于当前企业`);
    }
  }
}
