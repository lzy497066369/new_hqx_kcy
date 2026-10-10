import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import {
  resolveRedisRuntimeConfig,
  type RedisRuntimeConfig,
} from './redis-runtime.config';

export type RedisHealthStatus = 'disabled' | 'ok' | 'unavailable';

@Injectable()
export class RedisClientService implements OnModuleDestroy {
  private connectionPromise: Promise<void> | undefined;
  private readonly client: Redis | undefined;
  private readonly config: RedisRuntimeConfig;

  constructor() {
    this.config = resolveRedisRuntimeConfig();
    if (!this.config.enabled) return;
    if (!this.config.url) {
      throw new Error('REDIS_ENABLED requires REDIS_URL or REDIS_HOST');
    }

    this.client = new Redis(this.config.url, {
      connectTimeout: this.config.connectTimeoutMs,
      enableOfflineQueue: false,
      keyPrefix: this.config.keyPrefix,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
    });
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async getClient(): Promise<Redis> {
    if (!this.client) {
      throw new Error('Redis is disabled');
    }
    await this.ensureConnected();
    return this.client;
  }

  async ping(): Promise<RedisHealthStatus> {
    if (!this.client) return 'disabled';
    try {
      await this.ensureConnected();
      return (await this.client.ping()) === 'PONG' ? 'ok' : 'unavailable';
    } catch {
      return 'unavailable';
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client || this.client.status === 'ready') return;
    if (!this.connectionPromise) {
      this.connectionPromise = this.client
        .connect()
        .then(() => undefined)
        .finally(() => {
          this.connectionPromise = undefined;
        });
    }
    await this.connectionPromise;
  }
}
