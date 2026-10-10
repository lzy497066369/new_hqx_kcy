import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { ClientService } from './client.service';

@Injectable()
export class DeclarationReminderScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeclarationReminderScheduler.name);
  private running = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly clientService: ClientService) {}

  onModuleInit() {
    if (process.env.DECLARATION_REMINDER_SCHEDULER_ENABLED === '0') {
      return;
    }
    this.timer = setInterval(() => void this.tick(), 60_000);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.clientService.sendDueDeclarationNodeReminders();
    } catch (error) {
      this.logger.error('申报节点提醒扫描失败', error);
    } finally {
      this.running = false;
    }
  }
}
