import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CrmSyncService } from './crm-sync.service';

@Injectable()
export class CrmSyncScheduler implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(CrmSyncScheduler.name);
  private running = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly crmSyncService: CrmSyncService,
  ) {}

  onModuleInit(): void {
    if (this.configService.get<string>('CRM_SYNC_POLL_ENABLED') === '0') {
      return;
    }

    this.timer = setInterval(() => void this.tick(), this.pollIntervalMs());
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;

    this.running = true;
    try {
      const result = await this.crmSyncService.processPendingRecords({
        batchSize: this.positiveIntegerConfig('CRM_SYNC_BATCH_SIZE', 20),
        maxRetry: this.nonNegativeIntegerConfig('CRM_SYNC_MAX_RETRY', 3),
        processingTimeoutMs: this.positiveIntegerConfig(
          'CRM_SYNC_PROCESSING_TIMEOUT_MS',
          15 * 60 * 1000,
        ),
      });
      if (result.contracts.processed || result.executionOrders.processed) {
        this.logger.log(`CRM 数据库同步完成：合同 ${result.contracts.processed} 条，执行单 ${result.executionOrders.processed} 条`);
      }
    } catch (error) {
      this.logger.error('CRM 数据库同步轮询失败', error);
    } finally {
      this.running = false;
    }
  }

  private pollIntervalMs(): number {
    return this.positiveIntegerConfig('CRM_SYNC_POLL_INTERVAL_MS', 30_000);
  }

  private positiveIntegerConfig(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key));
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  }

  private nonNegativeIntegerConfig(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key));
    return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
  }
}
