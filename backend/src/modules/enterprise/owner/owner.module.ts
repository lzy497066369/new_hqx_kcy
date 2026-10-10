import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { EnterpriseAccountService } from '../shared/enterprise-account.service';
import { EnterpriseOwnerController } from './owner.controller';
import { EnterpriseOwnerService } from './owner.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [EnterpriseOwnerController],
  providers: [EnterpriseAccountService, EnterpriseOwnerService],
})
export class EnterpriseOwnerModule {}
