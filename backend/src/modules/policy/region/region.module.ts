import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { RegionAccessService } from '../shared/region-access.service';
import { PolicyRegionController } from './region.controller';
import { PolicyRegionService } from './region.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [PolicyRegionController],
  providers: [PolicyRegionService, RegionAccessService],
  exports: [PolicyRegionService],
})
export class PolicyRegionModule {}
