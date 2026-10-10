import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { AuthModule } from '../../auth/auth.module';
import { EnterpriseAccountService } from '../shared/enterprise-account.service';
import { EnterpriseImportController } from './import.controller';
import { EnterpriseImportService } from './import.service';
import { TianyanchaClientService } from './tianyancha-client.service';
import { TianyanchaLogService } from './tianyancha-log.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [EnterpriseImportController],
  exports: [EnterpriseImportService],
  providers: [
    EnterpriseAccountService,
    EnterpriseImportService,
    TianyanchaClientService,
    TianyanchaLogService,
  ],
})
export class EnterpriseImportModule {}
