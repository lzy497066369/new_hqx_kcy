import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { DataSource, In, LessThan, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { CrmIntegrationClientEntity } from '../../infrastructure/database/entities/crm-integration-client.entity';
import { CrmIntegrationInboundRequestEntity } from '../../infrastructure/database/entities/crm-integration-inbound-request.entity';
import { CrmIntegrationKeyEntity } from '../../infrastructure/database/entities/crm-integration-key.entity';
import { CrmIntegrationNonceEntity } from '../../infrastructure/database/entities/crm-integration-nonce.entity';
import { CrmIntegrationOutboxTaskEntity } from '../../infrastructure/database/entities/crm-integration-outbox-task.entity';
import {
  CreateCrmIntegrationClientInput,
  CreateCrmIntegrationKeyInput,
  CrmContractSyncInput,
  CrmExecutionOrderSyncInput,
} from './dto';
import { CrmSyncService } from './crm-sync.service';

type CrmIntegrationRequestType = 'contract' | 'execution_order';

type SignedRequest = {
  body: Buffer;
  headers: Record<string, string | string[] | undefined>;
  ip: string | undefined;
  method: string;
  pathAndQuery: string;
};

type VerifiedCaller = {
  client: CrmIntegrationClientEntity;
  key: CrmIntegrationKeyEntity;
};

type SyncResult = {
  failureReason: null | string;
  id: string;
  processStatus: 'failed' | 'processing' | 'received' | 'skipped' | 'success';
};

const MAX_BODY_BYTES = 64 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;
const NONCE_TTL_SECONDS = 10 * 60;
const MAX_TASK_ATTEMPTS = 5;

@Injectable()
export class CrmIntegrationService implements OnModuleDestroy, OnModuleInit {
  private draining = false;
  private lastNonceCleanupAt = 0;
  private workerTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(CrmIntegrationClientEntity)
    private readonly clientRepo: Repository<CrmIntegrationClientEntity>,
    @InjectRepository(CrmIntegrationInboundRequestEntity)
    private readonly inboundRepo: Repository<CrmIntegrationInboundRequestEntity>,
    @InjectRepository(CrmIntegrationKeyEntity)
    private readonly keyRepo: Repository<CrmIntegrationKeyEntity>,
    @InjectRepository(CrmIntegrationNonceEntity)
    private readonly nonceRepo: Repository<CrmIntegrationNonceEntity>,
    @InjectRepository(CrmIntegrationOutboxTaskEntity)
    private readonly taskRepo: Repository<CrmIntegrationOutboxTaskEntity>,
    private readonly configService: ConfigService,
    private readonly crmSyncService: CrmSyncService,
  ) {}

  onModuleInit(): void {
    this.workerTimer = setInterval(() => void this.drainQueue().catch(() => undefined), 1000);
    void this.drainQueue().catch(() => undefined);
  }

  onModuleDestroy(): void {
    if (this.workerTimer) clearInterval(this.workerTimer);
    this.workerTimer = null;
  }

  async createClient(input: CreateCrmIntegrationClientInput) {
    const appId = (input.appId?.trim() || `crm_${randomBytes(9).toString('base64url')}`).trim();
    if (!/^[A-Za-z0-9_-]{3,64}$/u.test(appId)) {
      throw new BadRequestException('appId 只能包含字母、数字、下划线和短横线');
    }
    const name = input.name.trim();
    if (!name) throw new BadRequestException('调用方名称不能为空');
    const existing = await this.clientRepo.findOne({ where: { appId } });
    if (existing) throw new ConflictException('appId 已存在');

    const saved = await this.clientRepo.save(this.clientRepo.create({
      allowedIpCidrs: this.toNullable(input.allowedIpCidrs),
      appId,
      name,
      rateLimitPerMinute: input.rateLimitPerMinute ?? 60,
      status: 1,
    }));
    return this.toClientItem(saved, []);
  }

  async createKey(clientId: string, input: CreateCrmIntegrationKeyInput) {
    const client = await this.requireClient(clientId);
    const keyId = (input.keyId?.trim() || `key_${randomBytes(6).toString('base64url')}`).trim();
    if (!/^[A-Za-z0-9_-]{3,64}$/u.test(keyId)) {
      throw new BadRequestException('keyId 只能包含字母、数字、下划线和短横线');
    }
    const existed = await this.keyRepo.findOne({ where: { clientId: client.id, keyId } });
    if (existed) throw new ConflictException('keyId 已存在');
    const expiresAt = this.parseOptionalDate(input.expiresAt);
    const secret = randomBytes(32).toString('base64url');
    const saved = await this.keyRepo.save(this.keyRepo.create({
      clientId: client.id,
      expiresAt,
      keyId,
      lastUsedAt: null,
      scopes: this.normalizeScopes(input.scopes),
      secretEncrypted: this.encryptSecret(secret),
      status: 1,
    }));
    return {
      ...this.toKeyItem(saved),
      secret,
    };
  }

  async disableKey(id: string) {
    const key = await this.keyRepo.findOne({ where: { id } });
    if (!key) throw new NotFoundException('CRM 密钥不存在');
    key.status = 0;
    await this.keyRepo.save(key);
    return this.toKeyItem(key);
  }

  async listClients() {
    const [clients, keys] = await Promise.all([
      this.clientRepo.find({ order: { createdAt: 'DESC', id: 'DESC' } }),
      this.keyRepo.find({ order: { createdAt: 'DESC', id: 'DESC' } }),
    ]);
    return clients.map((client) => this.toClientItem(
      client,
      keys.filter((key) => key.clientId === client.id),
    ));
  }

  async listInboundRequests(query: Record<string, string | string[] | undefined>) {
    const page = Math.max(1, Number(this.queryValue(query.page) ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(this.queryValue(query.pageSize) ?? 20) || 20));
    const rows = await this.inboundRepo.find({ order: { updatedAt: 'DESC', id: 'DESC' } });
    const clientId = this.queryValue(query.clientId)?.trim();
    const processStatus = this.queryValue(query.processStatus)?.trim();
    const keyword = this.queryValue(query.keyword)?.trim().toLowerCase();
    const filtered = rows.filter((item) => {
      if (clientId && item.clientId !== clientId) return false;
      if (processStatus && item.processStatus !== processStatus) return false;
      if (!keyword) return true;
      return [item.sourceRequestId, item.requestType, item.requestIp]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(keyword));
    });
    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize).map((item) => this.toInboundItem(item)),
      total: filtered.length,
    };
  }

  async retryInboundRequest(id: string) {
    const inbound = await this.inboundRepo.findOne({ where: { id } });
    if (!inbound) throw new NotFoundException('CRM 入站请求不存在');
    const task = await this.taskRepo.findOne({ where: { inboundRequestId: inbound.id } });
    if (!task) throw new NotFoundException('CRM 异步任务不存在');
    if (task.status === 'processing') throw new ConflictException('CRM 请求正在处理中');
    inbound.failureReason = null;
    inbound.processStatus = 'accepted';
    inbound.processedAt = null;
    task.availableAt = new Date();
    task.completedAt = null;
    task.lastError = null;
    task.lockedAt = null;
    task.status = 'pending';
    await Promise.all([this.inboundRepo.save(inbound), this.taskRepo.save(task)]);
    void this.drainQueue();
    return this.toInboundItem(inbound);
  }

  async acceptContract(input: unknown, request: SignedRequest) {
    return this.accept('contract', input, request);
  }

  async acceptExecutionOrder(input: unknown, request: SignedRequest) {
    return this.accept('execution_order', input, request);
  }

  async getExternalRequestStatus(
    requestType: CrmIntegrationRequestType,
    sourceRequestId: string,
    request: SignedRequest,
  ) {
    const caller = await this.verifyRequest('status', request);
    const normalizedId = this.requiredString(sourceRequestId, 'sourceRequestId 不能为空');
    const sourceRequestHash = this.sha256(Buffer.from(normalizedId, 'utf8'));
    const inbound = await this.inboundRepo.findOne({
      where: {
        clientId: caller.client.id,
        requestType,
        sourceRequestHash,
      },
    });
    if (!inbound || inbound.sourceRequestId !== normalizedId) throw new NotFoundException('CRM 请求记录不存在');
    return this.toInboundItem(inbound);
  }

  private async accept(
    requestType: CrmIntegrationRequestType,
    input: unknown,
    request: SignedRequest,
  ) {
    const caller = await this.verifyRequest(
      requestType === 'contract' ? 'contracts' : 'execution_orders',
      request,
    );
    const normalizedInput = this.normalizeInput(requestType, input);
    const sourceRequestId = this.requiredString(normalizedInput.sourceRequestId, 'sourceRequestId 不能为空');
    const sourceRequestHash = this.sha256(Buffer.from(sourceRequestId, 'utf8'));
    const bodyHash = this.sha256(request.body);
    const now = new Date();
    await this.assertRateLimit(caller.client, now);

    try {
      const acceptance = await this.dataSource.transaction(async (manager) => {
        const nonceRepo = manager.getRepository(CrmIntegrationNonceEntity);
        const inboundRepo = manager.getRepository(CrmIntegrationInboundRequestEntity);
        const taskRepo = manager.getRepository(CrmIntegrationOutboxTaskEntity);
        await nonceRepo.save(nonceRepo.create({
          clientId: caller.client.id,
          expiresAt: new Date(now.getTime() + NONCE_TTL_SECONDS * 1000),
          nonce: this.header(request.headers, 'x-crm-nonce'),
        }));

        const existing = await inboundRepo.findOne({
          where: { clientId: caller.client.id, requestType, sourceRequestHash },
        });
        if (existing) {
          if (existing.sourceRequestId !== sourceRequestId) {
            throw new ConflictException('sourceRequestId 摘要冲突');
          }
          if (!this.isEqual(existing.bodyHash, bodyHash)) {
            throw new ConflictException('同一 sourceRequestId 的请求内容不一致');
          }
          return { duplicate: true, inbound: existing };
        }

        const saved = await inboundRepo.save(inboundRepo.create({
          bodyHash,
          clientId: caller.client.id,
          failureReason: null,
          keyId: caller.key.keyId,
          processStatus: 'accepted',
          processedAt: null,
          requestIp: this.toNullable(request.ip),
          requestJson: JSON.stringify(normalizedInput),
          requestType,
          sourceRequestId,
          sourceRequestHash,
          syncRecordId: null,
          syncRecordType: null,
        }));
        await taskRepo.save(taskRepo.create({
          attemptCount: 0,
          availableAt: now,
          completedAt: null,
          inboundRequestId: saved.id,
          lastError: null,
          lockedAt: null,
          requestType,
          status: 'pending',
        }));
        return { duplicate: false, inbound: saved };
      });
      void this.drainQueue();
      return {
        ...this.toInboundItem(acceptance.inbound),
        duplicate: acceptance.duplicate,
      };
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;
      const existing = await this.inboundRepo.findOne({
        where: { clientId: caller.client.id, requestType, sourceRequestHash },
      });
      if (existing && existing.sourceRequestId === sourceRequestId && this.isEqual(existing.bodyHash, bodyHash)) {
        return { ...this.toInboundItem(existing), duplicate: true };
      }
      throw new ConflictException('请求随机数已使用或 sourceRequestId 冲突');
    }
  }

  private async verifyRequest(requiredScope: string, request: SignedRequest): Promise<VerifiedCaller> {
    if (request.body.length > MAX_BODY_BYTES) throw new BadRequestException('请求体超过 64 KiB 限制');
    const appId = this.header(request.headers, 'x-crm-app-id');
    const keyId = this.header(request.headers, 'x-crm-key-id');
    const nonce = this.header(request.headers, 'x-crm-nonce');
    const signature = this.header(request.headers, 'x-crm-signature');
    const timestamp = this.header(request.headers, 'x-crm-timestamp');
    const bodyHash = this.header(request.headers, 'x-crm-body-sha256');
    if (!appId || !keyId || !nonce || !signature || !timestamp || !bodyHash) {
      throw new UnauthorizedException('缺少 CRM v2 签名请求头');
    }
    if (!/^[A-Za-z0-9_-]{16,128}$/u.test(nonce)) throw new BadRequestException('CRM nonce 格式无效');
    if (!/^\d{10}$/u.test(timestamp)) throw new BadRequestException('CRM timestamp 格式无效');
    const timestampSeconds = Number(timestamp);
    if (Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) {
      throw new UnauthorizedException('CRM 请求时间超出允许范围');
    }
    const actualBodyHash = this.sha256(request.body);
    if (!/^[a-f0-9]{64}$/iu.test(bodyHash) || !this.isEqual(bodyHash.toLowerCase(), actualBodyHash)) {
      throw new BadRequestException('CRM 请求体摘要不匹配');
    }

    const client = await this.clientRepo.findOne({ where: { appId, status: 1 } });
    if (!client) throw new UnauthorizedException('CRM 调用方无效或已停用');
    if (!this.isIpAllowed(client.allowedIpCidrs, request.ip)) throw new ForbiddenException('CRM 来源 IP 未获授权');
    const key = await this.keyRepo.findOne({ where: { clientId: client.id, keyId, status: 1 } });
    if (!key || (key.expiresAt && key.expiresAt.getTime() <= Date.now())) {
      throw new UnauthorizedException('CRM 密钥无效、已停用或已过期');
    }
    if (!this.parseScopes(key.scopes).has(requiredScope)) throw new ForbiddenException('CRM 密钥没有该接口权限');

    const canonical = [request.method.toUpperCase(), request.pathAndQuery, timestamp, nonce, actualBodyHash].join('\n');
    const expected = createHmac('sha256', this.decryptSecret(key.secretEncrypted))
      .update(canonical, 'utf8')
      .digest('base64url');
    if (!this.isEqual(signature, expected)) throw new UnauthorizedException('CRM 请求签名无效');
    key.lastUsedAt = new Date();
    await this.keyRepo.save(key);
    return { client, key };
  }

  private async drainQueue(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      const now = new Date();
      if (now.getTime() - this.lastNonceCleanupAt > 60_000) {
        await this.nonceRepo.delete({ expiresAt: LessThan(now) });
        this.lastNonceCleanupAt = now.getTime();
      }
      await this.taskRepo.createQueryBuilder()
        .update()
        .set({ availableAt: now, lockedAt: null, status: 'retry' })
        .where('status = :status AND locked_at < :staleBefore', {
          staleBefore: new Date(now.getTime() - 15 * 60 * 1000),
          status: 'processing',
        })
        .execute();
      const tasks = await this.taskRepo.find({
        order: { availableAt: 'ASC', id: 'ASC' },
        take: 10,
        where: [
          { availableAt: LessThanOrEqual(now), status: 'pending' },
          { availableAt: LessThanOrEqual(now), status: 'retry' },
        ],
      });
      for (const task of tasks) {
        const claimed = await this.taskRepo.update(
          { id: task.id, status: In(['pending', 'retry']) },
          { lockedAt: new Date(), status: 'processing' },
        );
        if (!claimed.affected) continue;
        await this.processTask(task.id);
      }
    } finally {
      this.draining = false;
    }
  }

  private async processTask(taskId: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id: taskId, status: 'processing' } });
    if (!task) return;
    const inbound = await this.inboundRepo.findOne({ where: { id: task.inboundRequestId } });
    if (!inbound) {
      task.status = 'failed';
      task.lastError = '入站请求不存在';
      task.completedAt = new Date();
      await this.taskRepo.save(task);
      return;
    }
    inbound.processStatus = 'processing';
    inbound.failureReason = null;
    await this.inboundRepo.save(inbound);
    try {
      const internalSourceRequestId = `v2-${inbound.clientId}-${createHash('sha256')
        .update(`${inbound.requestType}:${inbound.sourceRequestId}`, 'utf8').digest('hex')}`;
      const result = inbound.syncRecordId && inbound.syncRecordType === inbound.requestType
        ? inbound.requestType === 'contract'
          ? await this.crmSyncService.retryContract(inbound.syncRecordId, 'crm_v2')
          : await this.crmSyncService.retryExecutionOrder(inbound.syncRecordId, 'crm_v2')
        : inbound.requestType === 'contract'
          ? await this.crmSyncService.receiveContract({
            ...this.parsePayload(inbound.requestJson, 'contract'),
            sourceRequestId: internalSourceRequestId,
          })
          : await this.crmSyncService.receiveExecutionOrder({
            ...this.parsePayload(inbound.requestJson, 'execution_order'),
            sourceRequestId: internalSourceRequestId,
          });
      const typedResult = result as SyncResult;
      inbound.failureReason = typedResult.failureReason;
      inbound.processStatus = typedResult.processStatus === 'received'
        ? 'processing'
        : typedResult.processStatus;
      inbound.processedAt = new Date();
      inbound.syncRecordId = typedResult.id;
      inbound.syncRecordType = inbound.requestType;
      await this.inboundRepo.save(inbound);
      task.completedAt = new Date();
      task.lastError = null;
      task.status = 'completed';
      await this.taskRepo.save(task);
    } catch (error) {
      task.attemptCount += 1;
      task.lastError = this.errorMessage(error);
      if (task.attemptCount >= MAX_TASK_ATTEMPTS) {
        inbound.failureReason = task.lastError;
        inbound.processStatus = 'failed';
        inbound.processedAt = new Date();
        task.completedAt = new Date();
        task.status = 'failed';
      } else {
        task.availableAt = new Date(Date.now() + Math.min(60_000, 1000 * (2 ** task.attemptCount)));
        task.status = 'retry';
      }
      await Promise.all([this.inboundRepo.save(inbound), this.taskRepo.save(task)]);
    }
  }

  private async assertRateLimit(client: CrmIntegrationClientEntity, now: Date): Promise<void> {
    const count = await this.inboundRepo.count({
      where: { clientId: client.id, createdAt: MoreThanOrEqual(new Date(now.getTime() - 60_000)) },
    });
    if (count >= client.rateLimitPerMinute) throw new HttpException('CRM 调用频率超过限制', 429);
  }

  private async requireClient(id: string): Promise<CrmIntegrationClientEntity> {
    const client = await this.clientRepo.findOne({ where: { id } });
    if (!client) throw new NotFoundException('CRM 调用方不存在');
    return client;
  }

  private parsePayload(value: string, requestType: 'contract'): CrmContractSyncInput;
  private parsePayload(value: string, requestType: 'execution_order'): CrmExecutionOrderSyncInput;
  private parsePayload(value: string, requestType: CrmIntegrationRequestType) {
    try {
      const parsed = JSON.parse(value) as CrmContractSyncInput | CrmExecutionOrderSyncInput;
      if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
      return requestType === 'contract'
        ? parsed as CrmContractSyncInput
        : parsed as CrmExecutionOrderSyncInput;
    } catch {
      throw new Error('CRM 入站请求数据无法解析');
    }
  }

  private normalizeInput(
    requestType: CrmIntegrationRequestType,
    value: unknown,
  ): CrmContractSyncInput | CrmExecutionOrderSyncInput {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('CRM 请求体必须是 JSON 对象');
    }
    const input = value as Record<string, unknown>;
    const contractRules: Record<string, { max: number; required?: boolean }> = {
      accountManagerName: { max: 64 },
      companyName: { max: 255, required: true },
      contractName: { max: 255 },
      contractNo: { max: 128 },
      customerContractNo: { max: 128 },
      eventType: { max: 32 },
      sequenceNo: { max: 64 },
      sourceRecordId: { max: 128 },
      sourceRequestId: { max: 128, required: true },
      sourceUpdatedAt: { max: 40 },
      sourceVersion: { max: 64 },
      vendorName: { max: 128 },
    };
    const executionOrderRules: Record<string, { max: number; required?: boolean }> = {
      accountManagerName: { max: 64 },
      companyName: { max: 255, required: true },
      contractNo: { max: 128 },
      contractReviewStatus: { max: 64 },
      eventType: { max: 32 },
      executionDepartment: { max: 128 },
      executionOrderName: { max: 500, required: true },
      isCarriedForward: { max: 32 },
      orderNo: { max: 128, required: true },
      productManagerName: { max: 64 },
      sourceRecordId: { max: 128 },
      sourceRequestId: { max: 128, required: true },
      sourceUpdatedAt: { max: 40 },
      sourceVersion: { max: 64 },
    };
    const rules = requestType === 'contract' ? contractRules : executionOrderRules;
    const normalized: Record<string, string> = {};
    for (const key of Object.keys(input)) {
      if (!(key in rules)) throw new BadRequestException(`不允许的 CRM 请求字段：${key}`);
    }
    for (const [key, rule] of Object.entries(rules)) {
      const field = input[key];
      if (field === undefined) {
        if (rule.required) throw new BadRequestException(`${key} 不能为空`);
        continue;
      }
      if (typeof field !== 'string') throw new BadRequestException(`${key} 必须是字符串`);
      const text = field.trim();
      if (rule.required && !text) throw new BadRequestException(`${key} 不能为空`);
      if (text.length > rule.max) throw new BadRequestException(`${key} 长度不能超过 ${rule.max}`);
      if (key === 'eventType' && !['cancelled', 'created', 'updated'].includes(text)) {
        throw new BadRequestException('eventType 必须为 created、updated 或 cancelled');
      }
      if (text) normalized[key] = text;
    }
    return normalized as unknown as CrmContractSyncInput | CrmExecutionOrderSyncInput;
  }

  private toClientItem(client: CrmIntegrationClientEntity, keys: CrmIntegrationKeyEntity[]) {
    return {
      allowedIpCidrs: client.allowedIpCidrs,
      appId: client.appId,
      createdAt: client.createdAt,
      id: client.id,
      keys: keys.map((key) => this.toKeyItem(key)),
      name: client.name,
      rateLimitPerMinute: client.rateLimitPerMinute,
      status: client.status,
      updatedAt: client.updatedAt,
    };
  }

  private toInboundItem(item: CrmIntegrationInboundRequestEntity) {
    return {
      clientId: item.clientId,
      createdAt: item.createdAt,
      failureReason: item.failureReason,
      id: item.id,
      processStatus: item.processStatus,
      processedAt: item.processedAt,
      requestType: item.requestType,
      sourceRequestId: item.sourceRequestId,
      syncRecordId: item.syncRecordId,
      syncRecordType: item.syncRecordType,
      updatedAt: item.updatedAt,
    };
  }

  private toKeyItem(key: CrmIntegrationKeyEntity) {
    return {
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      id: key.id,
      keyId: key.keyId,
      lastUsedAt: key.lastUsedAt,
      scopes: [...this.parseScopes(key.scopes)],
      status: key.status,
      updatedAt: key.updatedAt,
    };
  }

  private encryptSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
  }

  private decryptSecret(value: string): string {
    const [ivValue, tagValue, encryptedValue] = value.split('.');
    if (!ivValue || !tagValue || !encryptedValue) throw new InternalServerErrorException('CRM 密钥密文无效');
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(ivValue, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException('CRM 密钥无法解密');
    }
  }

  private encryptionKey(): Buffer {
    const configured = this.configService.get<string>('CRM_INTEGRATION_ENCRYPTION_KEY')?.trim();
    if (!configured) throw new ServiceUnavailableException('缺少 CRM_INTEGRATION_ENCRYPTION_KEY 配置');
    const key = Buffer.from(configured, 'base64url');
    if (key.length !== 32) throw new ServiceUnavailableException('CRM_INTEGRATION_ENCRYPTION_KEY 必须是 32 字节 Base64URL 值');
    return key;
  }

  private header(headers: SignedRequest['headers'], name: string): string {
    const value = headers[name];
    const normalized = Array.isArray(value) ? value[0] : value;
    return normalized?.trim() ?? '';
  }

  private isIpAllowed(configured: null | string, requestIp: string | undefined): boolean {
    if (!configured?.trim()) return true;
    const ip = this.normalizeIp(requestIp);
    if (!ip) return false;
    return configured.split(',').map((item) => item.trim()).filter(Boolean).some((rule) => {
      if (rule === '*') return true;
      if (!rule.includes('/')) return this.normalizeIp(rule) === ip;
      return this.isIpv4InCidr(ip, rule);
    });
  }

  private isIpv4InCidr(ip: string, cidr: string): boolean {
    const [network, bitsValue] = cidr.split('/');
    const bits = Number(bitsValue);
    const ipValue = this.ipv4ToNumber(ip);
    const networkValue = this.ipv4ToNumber(network ?? '');
    if (ipValue === null || networkValue === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    const mask = bits === 0 ? 0 : (0xffff_ffff << (32 - bits)) >>> 0;
    return (ipValue & mask) === (networkValue & mask);
  }

  private ipv4ToNumber(value: string): null | number {
    const parts = value.split('.');
    if (parts.length !== 4) return null;
    const numbers = parts.map((part) => Number(part));
    if (numbers.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    return (((numbers[0]! << 24) >>> 0) + (numbers[1]! << 16) + (numbers[2]! << 8) + numbers[3]!) >>> 0;
  }

  private normalizeIp(value: string | undefined): string | null {
    const normalized = value?.trim().replace(/^::ffff:/u, '');
    return normalized || null;
  }

  private normalizeScopes(value?: string): string {
    const scopes = this.parseScopes(value ?? 'contracts,execution_orders,status');
    if (scopes.size === 0) throw new BadRequestException('CRM 密钥权限不能为空');
    const allowed = new Set(['contracts', 'execution_orders', 'status']);
    if ([...scopes].some((scope) => !allowed.has(scope))) {
      throw new BadRequestException('CRM 密钥权限不合法');
    }
    return [...scopes].sort().join(',');
  }

  private parseScopes(value: string): Set<string> {
    return new Set(value.split(',').map((item) => item.trim()).filter(Boolean));
  }

  private parseOptionalDate(value?: string): Date | null {
    if (!value?.trim()) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      throw new BadRequestException('密钥过期时间必须是未来的有效日期');
    }
    return parsed;
  }

  private queryValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private requiredString(value: null | string | undefined, message: string): string {
    const normalized = value?.trim();
    if (!normalized) throw new BadRequestException(message);
    return normalized;
  }

  private toNullable(value: null | string | undefined): null | string {
    const normalized = value?.trim();
    return normalized || null;
  }

  private sha256(value: Buffer): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private isEqual(value: string, expected: string): boolean {
    const valueBuffer = Buffer.from(value);
    const expectedBuffer = Buffer.from(expected);
    return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error && error.message ? error.message.slice(0, 1000) : 'CRM 异步任务处理失败';
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const databaseError = error as { code?: unknown; errno?: unknown };
    return databaseError.code === 'ER_DUP_ENTRY' || databaseError.errno === 1062;
  }
}
