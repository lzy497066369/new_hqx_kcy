import { Global, Module } from '@nestjs/common';

import { RedisClientService } from './redis-client.service';

@Global()
@Module({
  exports: [RedisClientService],
  providers: [RedisClientService],
})
export class RedisModule {}
