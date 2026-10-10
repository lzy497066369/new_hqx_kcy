import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { IamAdminController } from './iam-admin.controller';
import { IamAdminAccessGuard } from './iam-admin-access.guard';
import { IamAdminAuditInterceptor } from './iam-admin-audit.interceptor';
import { IamAdminService } from './iam-admin.service';
import { IamDatabaseModule } from './iam-database.module';

@Module({
  controllers: [IamAdminController],
  imports: [AuthModule, IamDatabaseModule],
  providers: [IamAdminService, IamAdminAccessGuard, IamAdminAuditInterceptor],
})
export class IamAdminModule {}
