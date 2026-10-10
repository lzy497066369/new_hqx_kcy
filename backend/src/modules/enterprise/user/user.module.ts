import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { EnterpriseAccountService } from '../shared/enterprise-account.service';
import { EnterpriseUserController } from './user.controller';
import { EnterpriseUserService } from './user.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [EnterpriseUserController],
  providers: [EnterpriseAccountService, EnterpriseUserService],
})
export class EnterpriseUserModule {}
