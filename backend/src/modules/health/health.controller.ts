import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { RedisClientService } from '../../infrastructure/cache/redis-client.service';

@Controller()
export class HealthController {
  constructor(private readonly redisClient: RedisClientService) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      version: 'v0.10',
    };
  }

  @Get('health/redis')
  async redis() {
    const status = await this.redisClient.ping();
    if (status === 'unavailable') {
      throw new ServiceUnavailableException('Redis is unavailable');
    }
    return { status };
  }
}
