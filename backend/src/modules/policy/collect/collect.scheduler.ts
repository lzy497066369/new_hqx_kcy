import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PolicyCollectService } from './collect.service';

@Injectable()
export class PolicyCollectScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PolicyCollectScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly collectService: PolicyCollectService) {}

  onModuleInit() {
    if (process.env.POLICY_COLLECT_SCHEDULER_ENABLED === '0') {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
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
      await this.collectService.runDueJobs();
    } catch (error) {
      this.logger.error('政策采集定时任务扫描失败', error);
    } finally {
      this.running = false;
    }
  }
}
