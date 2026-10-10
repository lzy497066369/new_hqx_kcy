import { Module } from '@nestjs/common';

import { AiModule } from '../../ai/ai.module';
import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { RegionPolicyFileController } from './file.controller';
import { RegionPolicyFileService } from './file.service';
import { RegionAccessService } from '../shared/region-access.service';

@Module({
  imports: [AiModule, AuthModule, DatabaseModule],
  controllers: [RegionPolicyFileController],
  providers: [RegionPolicyFileService, RegionAccessService],
  exports: [RegionPolicyFileService],
})
export class RegionPolicyFileModule {}
