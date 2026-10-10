import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { AiModule } from '../../ai/ai.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { RegionPolicyFileModule } from '../file/file.module';
import { PolicyCollectController } from './collect.controller';
import { PolicyCollectScheduler } from './collect.scheduler';
import { PolicyCollectService } from './collect.service';
import { PolicySearchProvider } from './policy-search.provider';
import { RegionAccessService } from '../shared/region-access.service';

@Module({
  imports: [AuthModule, AiModule, DatabaseModule, RegionPolicyFileModule],
  controllers: [PolicyCollectController],
  providers: [
    PolicyCollectScheduler,
    PolicyCollectService,
    PolicySearchProvider,
    RegionAccessService,
  ],
  exports: [PolicyCollectService],
})
export class PolicyCollectModule {}
