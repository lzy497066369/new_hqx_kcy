import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { timingSafeEqual } from 'node:crypto';
import { In, LessThan, Repository } from 'typeorm';

import { ClientDeclarationEntity } from '../../infrastructure/database/entities/client-declaration.entity';
import { CrmContractSyncRecordEntity } from '../../infrastructure/database/entities/crm-contract-sync-record.entity';
import { CrmExecutionOrderSyncRecordEntity } from '../../infrastructure/database/entities/crm-execution-order-sync-record.entity';
import { CrmSyncAttemptLogEntity } from '../../infrastructure/database/entities/crm-sync-attempt-log.entity';
import { DeclarationSchemeEntity } from '../../infrastructure/database/entities/declaration-scheme.entity';
import { PolicyProjectEntity } from '../../infrastructure/database/entities/policy-project.entity';
import { EnterpriseImportService } from '../enterprise/import/import.service';
import { CRM_PROJECT_CODES, parseCrmExecutionOrderName } from './crm-sync-name-parser';
import { CrmContractSyncInput, CrmExecutionOrderSyncInput, CrmSyncEventType } from './dto';

type AttemptType = 'automatic' | 'retry';
type RecordType = 'contract' | 'execution_order';

type CrmSyncListQuery = Record<string, string | string[] | undefined>;

type DeclarationIdMap = Record<string, string>;

type CrmBusinessKey = {
  column: 'contractNo' | 'orderNo' | 'sourceRecordId';
  dbColumn: 'contract_no' | 'order_no' | 'source_record_id';
  value: string;
};

type CrmSyncBatchOptions = {
  batchSize: number;
  maxRetry: number;
  processingTimeoutMs: number;
};

@Injectable()
export class CrmSyncService {
  constructor(
    @InjectRepository(ClientDeclarationEntity)
    private readonly declarationRepo: Repository<ClientDeclarationEntity>,
    @InjectRepository(CrmContractSyncRecordEntity)
    private readonly contractRepo: Repository<CrmContractSyncRecordEntity>,
    @InjectRepository(CrmExecutionOrderSyncRecordEntity)
    private readonly executionOrderRepo: Repository<CrmExecutionOrderSyncRecordEntity>,
    @InjectRepository(CrmSyncAttemptLogEntity)
    private readonly attemptLogRepo: Repository<CrmSyncAttemptLogEntity>,
    @InjectRepository(DeclarationSchemeEntity)
    private readonly declarationSchemeRepo: Repository<DeclarationSchemeEntity>,
    @InjectRepository(PolicyProjectEntity)
    private readonly policyProjectRepo: Repository<PolicyProjectEntity>,
    private readonly configService: ConfigService,
    private readonly enterpriseImportService: EnterpriseImportService,
  ) {}

  assertExternalToken(token?: string): void {
    const configuredToken = this.configService.get<string>('CRM_SYNC_TOKEN')?.trim();
    if (!configuredToken) {
      throw new InternalServerErrorException('缺少环境变量 CRM_SYNC_TOKEN');
    }
    if (!token || !this.isTokenEqual(token.trim(), configuredToken)) {
      throw new UnauthorizedException('CRM 接口令牌无效');
    }
  }

  async receiveContract(input: CrmContractSyncInput) {
    const sourceRequestId = this.normalizeRequired(input.sourceRequestId, 'sourceRequestId 不能为空');
    const existing = await this.contractRepo.findOne({ where: { sourceRequestId } });
    if (existing) {
      return this.toContractItem(existing, true);
    }

    let saved: CrmContractSyncRecordEntity;
    try {
      saved = await this.contractRepo.save(this.contractRepo.create({
        accountManagerName: this.toNullable(input.accountManagerName),
        companyName: this.normalizeRequired(input.companyName, 'companyName 不能为空'),
        contractName: this.toNullable(input.contractName),
        contractNo: this.toNullable(input.contractNo),
        customerContractNo: this.toNullable(input.customerContractNo),
        enterpriseId: null,
        enterpriseName: null,
        eventType: this.normalizeEventType(input.eventType),
        failureReason: null,
        importResultJson: null,
        lastProcessedAt: null,
        payloadJson: JSON.stringify(input),
        processStatus: 'received',
        retryCount: 0,
        sequenceNo: this.toNullable(input.sequenceNo),
        sourceRecordId: this.toNullable(input.sourceRecordId),
        sourceRequestId,
        sourceUpdatedAt: this.toNullableDate(input.sourceUpdatedAt),
        sourceVersion: this.toNullable(input.sourceVersion),
        vendorName: this.toNullable(input.vendorName),
      }));
    } catch (error) {
      const concurrentRecord = await this.findContractAfterDuplicate(error, sourceRequestId);
      if (concurrentRecord) return this.toContractItem(concurrentRecord, true);
      throw error;
    }

    return this.processContract(saved, 'crm', 'automatic');
  }

  async receiveExecutionOrder(input: CrmExecutionOrderSyncInput) {
    const sourceRequestId = this.normalizeRequired(input.sourceRequestId, 'sourceRequestId 不能为空');
    const existing = await this.executionOrderRepo.findOne({ where: { sourceRequestId } });
    if (existing) {
      return this.toExecutionOrderItem(existing, true);
    }

    let saved: CrmExecutionOrderSyncRecordEntity;
    try {
      saved = await this.executionOrderRepo.save(this.executionOrderRepo.create({
        accountManagerName: this.toNullable(input.accountManagerName),
        companyName: this.normalizeRequired(input.companyName, 'companyName 不能为空'),
        contractNo: this.toNullable(input.contractNo),
        contractReviewStatus: this.toNullable(input.contractReviewStatus),
        declarationIdsJson: null,
        enterpriseId: null,
        enterpriseName: null,
        eventType: this.normalizeEventType(input.eventType),
        executionDepartment: this.toNullable(input.executionDepartment),
        executionOrderName: this.normalizeRequired(input.executionOrderName, 'executionOrderName 不能为空'),
        failureReason: null,
        intellectualPropertyCount: null,
        isCarriedForward: this.toNullable(input.isCarriedForward),
        lastProcessedAt: null,
        orderNo: this.normalizeRequired(input.orderNo, 'orderNo 不能为空'),
        payloadJson: JSON.stringify(input),
        processStatus: 'received',
        productManagerName: this.toNullable(input.productManagerName),
        recognizedProjectCodes: null,
        retryCount: 0,
        sourceRecordId: this.toNullable(input.sourceRecordId),
        sourceRequestId,
        sourceUpdatedAt: this.toNullableDate(input.sourceUpdatedAt),
        sourceVersion: this.toNullable(input.sourceVersion),
      }));
    } catch (error) {
      const concurrentRecord = await this.findExecutionOrderAfterDuplicate(error, sourceRequestId);
      if (concurrentRecord) return this.toExecutionOrderItem(concurrentRecord, true);
      throw error;
    }

    return this.processExecutionOrder(saved, 'crm', 'automatic');
  }

  async listContracts(query: CrmSyncListQuery) {
    const rows = await this.contractRepo.find({
      order: { updatedAt: 'DESC', id: 'DESC' },
    });
    const keyword = this.getQueryValue(query.keyword)?.trim().toLowerCase();
    const processStatus = this.getQueryValue(query.processStatus)?.trim();
    const filtered = rows.filter((row) => {
      if (processStatus && row.processStatus !== processStatus) return false;
      if (!keyword) return true;
      return [row.companyName, row.contractNo, row.contractName, row.accountManagerName]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(keyword));
    });
    return this.paginate(filtered, query, (row) => this.toContractItem(row));
  }

  async listExecutionOrders(query: CrmSyncListQuery) {
    const rows = await this.executionOrderRepo.find({
      order: { updatedAt: 'DESC', id: 'DESC' },
    });
    const keyword = this.getQueryValue(query.keyword)?.trim().toLowerCase();
    const processStatus = this.getQueryValue(query.processStatus)?.trim();
    const projectCode = this.getQueryValue(query.projectCode)?.trim();
    const filtered = rows.filter((row) => {
      if (processStatus && row.processStatus !== processStatus) return false;
      if (projectCode && !this.parseProjectCodes(row.recognizedProjectCodes).includes(projectCode)) return false;
      if (!keyword) return true;
      return [row.companyName, row.contractNo, row.executionOrderName, row.orderNo]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(keyword));
    });
    return this.paginate(filtered, query, (row) => this.toExecutionOrderItem(row));
  }

  async getContractDetail(id: string) {
    const record = await this.requireContract(id);
    return {
      ...this.toContractItem(record),
      attempts: await this.listAttempts('contract', record.id),
      payload: this.parseJson(record.payloadJson),
    };
  }

  async getExecutionOrderDetail(id: string) {
    const record = await this.requireExecutionOrder(id);
    return {
      ...this.toExecutionOrderItem(record),
      attempts: await this.listAttempts('execution_order', record.id),
      payload: this.parseJson(record.payloadJson),
    };
  }

  async retryContract(id: string, operatorName: string) {
    return this.processContract(await this.requireContract(id), operatorName, 'retry');
  }

  async retryExecutionOrder(id: string, operatorName: string) {
    return this.processExecutionOrder(
      await this.requireExecutionOrder(id),
      operatorName,
      'retry',
    );
  }

  async processPendingRecords(options: CrmSyncBatchOptions) {
    const staleBefore = new Date(Date.now() - options.processingTimeoutMs);
    const [contracts, executionOrders] = await Promise.all([
      this.contractRepo.find({
        order: { createdAt: 'ASC', id: 'ASC' },
        take: options.batchSize,
        where: [
          { processStatus: 'received' },
          { processStatus: 'failed', retryCount: LessThan(options.maxRetry) },
          {
            processStatus: 'processing',
            retryCount: LessThan(options.maxRetry),
            updatedAt: LessThan(staleBefore),
          },
        ],
      }),
      this.executionOrderRepo.find({
        order: { createdAt: 'ASC', id: 'ASC' },
        take: options.batchSize,
        where: [
          { processStatus: 'received' },
          { processStatus: 'failed', retryCount: LessThan(options.maxRetry) },
          {
            processStatus: 'processing',
            retryCount: LessThan(options.maxRetry),
            updatedAt: LessThan(staleBefore),
          },
        ],
      }),
    ]);

    const result = {
      contracts: { processed: 0, failed: 0, skipped: 0, success: 0 },
      executionOrders: { processed: 0, failed: 0, skipped: 0, success: 0 },
    };

    for (const record of contracts) {
      const synced = await this.processContract(
        record,
        'crm_db_poller',
        record.processStatus === 'received' ? 'automatic' : 'retry',
      );
      result.contracts.processed += 1;
      if (synced.processStatus === 'success') result.contracts.success += 1;
      if (synced.processStatus === 'failed') result.contracts.failed += 1;
      if (synced.processStatus === 'skipped') result.contracts.skipped += 1;
    }

    for (const record of executionOrders) {
      const synced = await this.processExecutionOrder(
        record,
        'crm_db_poller',
        record.processStatus === 'received' ? 'automatic' : 'retry',
      );
      result.executionOrders.processed += 1;
      if (synced.processStatus === 'success') result.executionOrders.success += 1;
      if (synced.processStatus === 'failed') result.executionOrders.failed += 1;
      if (synced.processStatus === 'skipped') result.executionOrders.skipped += 1;
    }

    return result;
  }

  private async processContract(
    record: CrmContractSyncRecordEntity,
    actor: string,
    attemptType: AttemptType,
  ) {
    const claimed = await this.claimContract(record.id, attemptType);
    if (!claimed) return this.toContractItem(await this.requireContract(record.id));
    record = claimed;

    try {
      if (await this.shouldSkipContractRecord(record)) {
        record.failureReason = this.skipReason(record.eventType);
        record.lastProcessedAt = new Date();
        record.processStatus = 'skipped';
        await this.contractRepo.save(record);
        await this.createAttempt('contract', record.id, attemptType, 'skipped', actor, {
          eventType: record.eventType,
          sourceRecordId: record.sourceRecordId,
          sourceUpdatedAt: record.sourceUpdatedAt,
          sourceVersion: record.sourceVersion,
        }, record.failureReason);
        return this.toContractItem(record);
      }

      if (record.eventType === 'cancelled') {
        record.failureReason = 'CRM 事件类型为 cancelled，已跳过';
        record.lastProcessedAt = new Date();
        record.processStatus = 'skipped';
        await this.contractRepo.save(record);
        await this.createAttempt('contract', record.id, attemptType, 'skipped', actor, {
          eventType: record.eventType,
          sourceRecordId: record.sourceRecordId,
          sourceUpdatedAt: record.sourceUpdatedAt,
          sourceVersion: record.sourceVersion,
        }, record.failureReason);
        return this.toContractItem(record);
      }

      const imported = await this.importEnterprise(record.companyName, actor);
      record.enterpriseId = imported.enterpriseId;
      record.enterpriseName = imported.enterpriseName;
      record.failureReason = null;
      record.importResultJson = JSON.stringify(imported);
      record.lastProcessedAt = new Date();
      record.processStatus = 'success';
      await this.contractRepo.save(record);
      await this.createAttempt('contract', record.id, attemptType, 'success', actor, {
        enterpriseId: imported.enterpriseId,
        enterpriseName: imported.enterpriseName,
        existed: imported.existed,
      });
    } catch (error) {
      record.failureReason = this.getErrorMessage(error);
      record.lastProcessedAt = new Date();
      record.processStatus = 'failed';
      await this.contractRepo.save(record);
      await this.createAttempt('contract', record.id, attemptType, 'failed', actor, undefined, record.failureReason);
    }

    return this.toContractItem(record);
  }

  private async processExecutionOrder(
    record: CrmExecutionOrderSyncRecordEntity,
    actor: string,
    attemptType: AttemptType,
  ) {
    const claimed = await this.claimExecutionOrder(record.id, attemptType);
    if (!claimed) return this.toExecutionOrderItem(await this.requireExecutionOrder(record.id));
    record = claimed;

    try {
      if (await this.shouldSkipExecutionOrderRecord(record)) {
        record.failureReason = this.skipReason(record.eventType);
        record.lastProcessedAt = new Date();
        record.processStatus = 'skipped';
        await this.executionOrderRepo.save(record);
        await this.createAttempt('execution_order', record.id, attemptType, 'skipped', actor, {
          eventType: record.eventType,
          sourceRecordId: record.sourceRecordId,
          sourceUpdatedAt: record.sourceUpdatedAt,
          sourceVersion: record.sourceVersion,
        }, record.failureReason);
        return this.toExecutionOrderItem(record);
      }

      if (record.eventType === 'cancelled') {
        record.failureReason = 'CRM 事件类型为 cancelled，已跳过';
        record.lastProcessedAt = new Date();
        record.processStatus = 'skipped';
        await this.executionOrderRepo.save(record);
        await this.createAttempt('execution_order', record.id, attemptType, 'skipped', actor, {
          eventType: record.eventType,
          sourceRecordId: record.sourceRecordId,
          sourceUpdatedAt: record.sourceUpdatedAt,
          sourceVersion: record.sourceVersion,
        }, record.failureReason);
        return this.toExecutionOrderItem(record);
      }

      const parsed = parseCrmExecutionOrderName(record.executionOrderName);
      record.intellectualPropertyCount = parsed.intellectualPropertyCount;
      record.recognizedProjectCodes = parsed.projectCodes.join(',') || null;

      if (parsed.projectCodes.length === 0) {
        record.declarationIdsJson = JSON.stringify({});
        record.failureReason = '项目执行单名称未识别到高企或科小申报';
        record.lastProcessedAt = new Date();
        record.processStatus = 'skipped';
        await this.executionOrderRepo.save(record);
        await this.createAttempt('execution_order', record.id, attemptType, 'skipped', actor, {
          intellectualPropertyCount: parsed.intellectualPropertyCount,
        }, record.failureReason);
        return this.toExecutionOrderItem(record);
      }

      const enterprise = await this.resolveExecutionEnterprise(record, actor);
      record.enterpriseId = enterprise.enterpriseId;
      record.enterpriseName = enterprise.enterpriseName;

      const declarationIds = this.parseDeclarationIds(record.declarationIdsJson);
      for (const projectCode of parsed.projectCodes) {
        if (!declarationIds[projectCode]) {
          declarationIds[projectCode] = await this.createDeclaration(
            enterprise.enterpriseId,
            enterprise.enterpriseName,
            projectCode,
            record,
          );
          record.declarationIdsJson = JSON.stringify(declarationIds);
          await this.executionOrderRepo.save(record);
        }
      }

      record.declarationIdsJson = JSON.stringify(declarationIds);
      record.failureReason = null;
      record.lastProcessedAt = new Date();
      record.processStatus = 'success';
      await this.executionOrderRepo.save(record);
      await this.createAttempt('execution_order', record.id, attemptType, 'success', actor, {
        declarationIds,
        intellectualPropertyCount: parsed.intellectualPropertyCount,
        projectCodes: parsed.projectCodes,
      });
    } catch (error) {
      record.failureReason = this.getErrorMessage(error);
      record.lastProcessedAt = new Date();
      record.processStatus = 'failed';
      await this.executionOrderRepo.save(record);
      await this.createAttempt('execution_order', record.id, attemptType, 'failed', actor, undefined, record.failureReason);
    }

    return this.toExecutionOrderItem(record);
  }

  private async resolveExecutionEnterprise(
    record: CrmExecutionOrderSyncRecordEntity,
    actor: string,
  ) {
    if (record.enterpriseId && record.enterpriseName) {
      return { enterpriseId: record.enterpriseId, enterpriseName: record.enterpriseName };
    }
    if (record.contractNo) {
      const contract = await this.contractRepo.findOne({
        order: { updatedAt: 'DESC', id: 'DESC' },
        where: { contractNo: record.contractNo, processStatus: 'success' },
      });
      if (contract?.enterpriseId && contract.enterpriseName) {
        return { enterpriseId: contract.enterpriseId, enterpriseName: contract.enterpriseName };
      }
    }
    return this.importEnterprise(record.companyName, actor);
  }

  private async importEnterprise(companyName: string, actor: string) {
    const normalizedCompanyName = this.normalizeCompanyName(companyName);
    const result = await this.enterpriseImportService.search(companyName, { username: actor });
    const match = result.items.find(
      (item) => this.normalizeCompanyName(item.name) === normalizedCompanyName,
    );
    if (!match) {
      throw new Error('天眼查未找到与 CRM 客户名称完全一致的企业');
    }

    const imported = await this.enterpriseImportService.confirm({
      createAccounts: false,
      externalId: match.externalId,
      selectedPersonIds: [],
    }, { username: actor });
    const resultData = imported as {
      enterpriseId: string;
      enterpriseName: string;
      existed: boolean;
    };
    return resultData;
  }

  private async createDeclaration(
    enterpriseId: string,
    enterpriseName: string,
    projectCode: string,
    record: CrmExecutionOrderSyncRecordEntity,
  ): Promise<string> {
    const project = await this.policyProjectRepo.findOne({
      where: { code: projectCode, enabled: 1 },
    });
    if (!project) {
      const projectLabel = projectCode === CRM_PROJECT_CODES.GAOXIN
        ? '国家高新技术企业'
        : '省级科技型中小企业';
      throw new Error(`未配置已启用的“${projectLabel}”政策项目`);
    }

    const existing = await this.declarationRepo.findOne({
      order: { id: 'DESC' },
      where: {
        enterpriseId,
        projectId: project.id,
        status: In(['draft', 'preparing', 'reviewing', 'submitted', 'rejected']),
      },
    });
    if (existing) return existing.id;

    const scheme = await this.resolveCrmDeclarationScheme(project.id);
    const saved = await this.declarationRepo.save(this.declarationRepo.create({
      currentNodeName: '草稿',
      deadline: null,
      declarationNo: `CRM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      enterpriseId,
      enterpriseName,
      missingMaterialCount: 0,
      policyFileIds: null,
      policyType: project.policyType,
      progress: 0,
      projectId: project.id,
      projectName: project.name,
      rejectedReason: null,
      schemeId: scheme?.id ?? null,
      schemeVersion: scheme?.version ?? null,
      snapshotJson: JSON.stringify({
        createdFrom: 'crm_execution_order',
        crmExecutionOrderId: record.id,
        crmExecutionOrderName: record.executionOrderName,
        crmOrderNo: record.orderNo,
        crmSourceRecordId: record.sourceRecordId,
        crmSourceUpdatedAt: record.sourceUpdatedAt,
        crmSourceVersion: record.sourceVersion,
        crmSyncEventType: record.eventType,
        intellectualPropertyCount: record.intellectualPropertyCount,
        scheme: scheme ? this.toCrmDeclarationSchemeSnapshot(scheme) : null,
        sourceRequestId: record.sourceRequestId,
      }),
      status: 'draft',
      submitTime: null,
    }));
    return saved.id;
  }

  private async resolveCrmDeclarationScheme(projectId: string) {
    const schemes = await this.declarationSchemeRepo.find({
      where: { projectId, status: 'published' },
    });
    if (schemes.length === 0) return null;

    const now = new Date();
    return schemes
      .filter((scheme) =>
        (!scheme.effectiveStartDate || scheme.effectiveStartDate <= now) &&
        (!scheme.effectiveEndDate || scheme.effectiveEndDate >= now),
      )
      .sort((left, right) => {
        const leftDefaultRank = left.regionId ? 0 : 1;
        const rightDefaultRank = right.regionId ? 0 : 1;
        return (
          rightDefaultRank - leftDefaultRank ||
          Number(right.id) - Number(left.id)
        );
      })[0] ?? null;
  }

  private toCrmDeclarationSchemeSnapshot(scheme: DeclarationSchemeEntity) {
    return {
      id: String(scheme.id),
      regionId: scheme.regionId ? String(scheme.regionId) : null,
      schemeName: scheme.schemeName,
      version: scheme.version,
    };
  }

  private async shouldSkipContractRecord(record: CrmContractSyncRecordEntity): Promise<boolean> {
    return this.hasNewerRecord(
      record,
      this.contractRepo,
      this.contractBusinessKey(record),
    );
  }

  private async shouldSkipExecutionOrderRecord(record: CrmExecutionOrderSyncRecordEntity): Promise<boolean> {
    return this.hasNewerRecord(
      record,
      this.executionOrderRepo,
      this.executionOrderBusinessKey(record),
    );
  }

  private async hasNewerRecord<T extends CrmContractSyncRecordEntity | CrmExecutionOrderSyncRecordEntity>(
    record: T,
    repo: Repository<T>,
    businessKey: CrmBusinessKey | null,
  ): Promise<boolean> {
    if (!businessKey || (!record.sourceUpdatedAt && !record.sourceVersion)) return false;
    const rows = await repo.createQueryBuilder('record')
      .where(`record.${businessKey.dbColumn} = :businessKey`, { businessKey: businessKey.value })
      .andWhere('record.id <> :id', { id: record.id })
      .orderBy('record.source_updated_at', 'DESC')
      .addOrderBy('record.created_at', 'DESC')
      .addOrderBy('record.id', 'DESC')
      .getMany();

    return rows.some((other) => this.isNewerCrmEvent(other, record));
  }

  private contractBusinessKey(record: CrmContractSyncRecordEntity): CrmBusinessKey | null {
    if (record.sourceRecordId) {
      return { column: 'sourceRecordId', dbColumn: 'source_record_id', value: record.sourceRecordId };
    }
    if (record.contractNo) {
      return { column: 'contractNo', dbColumn: 'contract_no', value: record.contractNo };
    }
    return null;
  }

  private executionOrderBusinessKey(record: CrmExecutionOrderSyncRecordEntity): CrmBusinessKey | null {
    if (record.sourceRecordId) {
      return { column: 'sourceRecordId', dbColumn: 'source_record_id', value: record.sourceRecordId };
    }
    return { column: 'orderNo', dbColumn: 'order_no', value: record.orderNo };
  }

  private isNewerCrmEvent(
    other: CrmContractSyncRecordEntity | CrmExecutionOrderSyncRecordEntity,
    current: CrmContractSyncRecordEntity | CrmExecutionOrderSyncRecordEntity,
  ): boolean {
    const currentTime = current.sourceUpdatedAt?.getTime();
    const otherTime = other.sourceUpdatedAt?.getTime();
    if (currentTime !== undefined && otherTime !== undefined && otherTime > currentTime) return true;
    if (currentTime !== undefined && otherTime !== undefined && otherTime < currentTime) return false;
    return this.compareSourceVersion(other.sourceVersion, current.sourceVersion) > 0;
  }

  private compareSourceVersion(left: null | string, right: null | string): number {
    if (!left || !right) return 0;
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber === rightNumber ? 0 : leftNumber > rightNumber ? 1 : -1;
    }
    return left.localeCompare(right, 'zh-CN', { numeric: true, sensitivity: 'base' });
  }

  private skipReason(eventType: string): string {
    if (eventType === 'cancelled') return 'CRM 事件类型为 cancelled，已跳过';
    return 'CRM 已存在更新版本事件，当前记录已跳过';
  }

  private async createAttempt(
    recordType: RecordType,
    recordId: string,
    attemptType: AttemptType,
    status: 'failed' | 'skipped' | 'success',
    operatorName: string,
    result?: unknown,
    failureReason?: null | string,
  ): Promise<void> {
    await this.attemptLogRepo.save(this.attemptLogRepo.create({
      attemptType,
      failureReason: failureReason ?? null,
      operatorName: operatorName || null,
      recordId,
      recordType,
      resultJson: result === undefined ? null : JSON.stringify(result),
      status,
    }));
  }

  private async listAttempts(recordType: RecordType, recordId: string) {
    const rows = await this.attemptLogRepo.find({
      order: { createdAt: 'DESC', id: 'DESC' },
      where: { recordId, recordType },
    });
    return rows.map((row) => ({
      attemptType: row.attemptType,
      createdAt: row.createdAt,
      failureReason: row.failureReason,
      id: row.id,
      operatorName: row.operatorName,
      result: this.parseJson(row.resultJson),
      status: row.status,
    }));
  }

  private async requireContract(id: string) {
    const record = await this.contractRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('CRM 合同同步记录不存在');
    return record;
  }

  private async requireExecutionOrder(id: string) {
    const record = await this.executionOrderRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('CRM 执行单同步记录不存在');
    return record;
  }

  private async claimContract(id: string, attemptType: AttemptType) {
    const result = await this.contractRepo.createQueryBuilder()
      .update()
      .set({
        failureReason: null,
        processStatus: 'processing',
        ...(attemptType === 'retry' ? { retryCount: () => 'retry_count + 1' } : {}),
      })
      .where('id = :id', { id })
      .andWhere('(process_status <> :processing OR updated_at < :staleBefore)', {
        processing: 'processing',
        staleBefore: new Date(Date.now() - this.processingTimeoutMs()),
      })
      .execute();
    return result.affected ? this.requireContract(id) : null;
  }

  private async claimExecutionOrder(id: string, attemptType: AttemptType) {
    const result = await this.executionOrderRepo.createQueryBuilder()
      .update()
      .set({
        failureReason: null,
        processStatus: 'processing',
        ...(attemptType === 'retry' ? { retryCount: () => 'retry_count + 1' } : {}),
      })
      .where('id = :id', { id })
      .andWhere('(process_status <> :processing OR updated_at < :staleBefore)', {
        processing: 'processing',
        staleBefore: new Date(Date.now() - this.processingTimeoutMs()),
      })
      .execute();
    return result.affected ? this.requireExecutionOrder(id) : null;
  }

  private async findContractAfterDuplicate(error: unknown, sourceRequestId: string) {
    if (!this.isUniqueConstraintError(error)) return null;
    return this.contractRepo.findOne({ where: { sourceRequestId } });
  }

  private async findExecutionOrderAfterDuplicate(error: unknown, sourceRequestId: string) {
    if (!this.isUniqueConstraintError(error)) return null;
    return this.executionOrderRepo.findOne({ where: { sourceRequestId } });
  }

  private toContractItem(record: CrmContractSyncRecordEntity, duplicate = false) {
    return {
      accountManagerName: record.accountManagerName,
      companyName: record.companyName,
      contractName: record.contractName,
      contractNo: record.contractNo,
      createdAt: record.createdAt,
      customerContractNo: record.customerContractNo,
      duplicate,
      eventType: record.eventType,
      enterpriseId: record.enterpriseId,
      enterpriseName: record.enterpriseName,
      failureReason: record.failureReason,
      id: record.id,
      lastProcessedAt: record.lastProcessedAt,
      processStatus: record.processStatus,
      retryCount: record.retryCount,
      sequenceNo: record.sequenceNo,
      sourceRecordId: record.sourceRecordId,
      sourceRequestId: record.sourceRequestId,
      sourceUpdatedAt: record.sourceUpdatedAt,
      sourceVersion: record.sourceVersion,
      updatedAt: record.updatedAt,
      vendorName: record.vendorName,
    };
  }

  private toExecutionOrderItem(record: CrmExecutionOrderSyncRecordEntity, duplicate = false) {
    return {
      accountManagerName: record.accountManagerName,
      companyName: record.companyName,
      contractNo: record.contractNo,
      contractReviewStatus: record.contractReviewStatus,
      createdAt: record.createdAt,
      declarationIds: this.parseDeclarationIds(record.declarationIdsJson),
      duplicate,
      eventType: record.eventType,
      enterpriseId: record.enterpriseId,
      enterpriseName: record.enterpriseName,
      executionDepartment: record.executionDepartment,
      executionOrderName: record.executionOrderName,
      failureReason: record.failureReason,
      id: record.id,
      intellectualPropertyCount: record.intellectualPropertyCount,
      isCarriedForward: record.isCarriedForward,
      lastProcessedAt: record.lastProcessedAt,
      orderNo: record.orderNo,
      processStatus: record.processStatus,
      productManagerName: record.productManagerName,
      projectCodes: this.parseProjectCodes(record.recognizedProjectCodes),
      retryCount: record.retryCount,
      sourceRecordId: record.sourceRecordId,
      sourceRequestId: record.sourceRequestId,
      sourceUpdatedAt: record.sourceUpdatedAt,
      sourceVersion: record.sourceVersion,
      updatedAt: record.updatedAt,
    };
  }

  private paginate<T>(rows: T[], query: CrmSyncListQuery, map: (row: T) => unknown) {
    const page = Math.max(1, Number(this.getQueryValue(query.page) ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(this.getQueryValue(query.pageSize) ?? 20) || 20));
    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize).map(map),
      total: rows.length,
    };
  }

  private parseDeclarationIds(value: null | string): DeclarationIdMap {
    const parsed = this.parseJson(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.entries(parsed as Record<string, unknown>).reduce<DeclarationIdMap>(
      (result, [projectCode, declarationId]) => {
        if (typeof declarationId === 'string' && declarationId) {
          result[projectCode] = declarationId;
        }
        return result;
      },
      {},
    );
  }

  private parseProjectCodes(value: null | string): string[] {
    return (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  }

  private parseJson(value: null | string): unknown {
    if (!value) return null;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }

  private normalizeRequired(value: null | string | undefined, message: string): string {
    const normalized = value?.trim();
    if (!normalized) throw new BadRequestException(message);
    return normalized;
  }

  private normalizeEventType(value: CrmSyncEventType | null | string | undefined): CrmSyncEventType {
    const normalized = value?.trim() || 'created';
    if (normalized === 'created' || normalized === 'updated' || normalized === 'cancelled') {
      return normalized;
    }
    throw new BadRequestException('eventType 必须为 created、updated 或 cancelled');
  }

  private toNullable(value: null | string | undefined): null | string {
    const normalized = value?.trim();
    return normalized || null;
  }

  private toNullableDate(value: null | string | undefined): Date | null {
    const normalized = value?.trim();
    if (!normalized) return null;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('sourceUpdatedAt 时间格式无效');
    return parsed;
  }

  private normalizeCompanyName(value: string): string {
    return value
      .replace(/[()（）\s]/gu, '')
      .trim()
      .toLocaleLowerCase('zh-CN');
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message.slice(0, 1000);
    return 'CRM 同步处理失败';
  }

  private getQueryValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private isTokenEqual(value: string, expected: string): boolean {
    const valueBuffer = Buffer.from(value);
    const expectedBuffer = Buffer.from(expected);
    return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const databaseError = error as { code?: unknown; errno?: unknown };
    return databaseError.code === 'ER_DUP_ENTRY' || databaseError.errno === 1062;
  }

  private processingTimeoutMs(): number {
    return this.positiveIntegerConfig('CRM_SYNC_PROCESSING_TIMEOUT_MS', 15 * 60 * 1000);
  }

  private positiveIntegerConfig(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key));
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  }
}
