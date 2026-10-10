import { Module } from '@nestjs/common';

import { SystemMemoryStore } from './system-memory.store';

@Module({
  providers: [SystemMemoryStore],
  exports: [SystemMemoryStore],
})
export class MemoryModule {}
