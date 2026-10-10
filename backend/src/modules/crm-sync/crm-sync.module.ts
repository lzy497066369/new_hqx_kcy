import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { EnterpriseImportModule } from '../enterprise/import/import.module';
import { CrmIntegrationService } from './crm-integration.service';
import { CrmIntegrationAdminController, CrmSyncAdminController, CrmSyncExternalController, CrmSyncV2ExternalController } from './crm-sync.controller';
import { CrmSyncScheduler } from './crm-sync.scheduler';
import { CrmSyncService } from './crm-sync.service';

@Module({
  controllers: [
    CrmSyncExternalController,
    CrmSyncV2ExternalController,
    CrmSyncAdminController,
    CrmIntegrationAdminController,
  ],
  imports: [AuthModule, DatabaseModule, EnterpriseImportModule],
  providers: [CrmSyncService, CrmIntegrationService, CrmSyncScheduler],
})
export class CrmSyncModule {}
