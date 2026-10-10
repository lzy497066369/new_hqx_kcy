import { Module } from '@nestjs/common';

import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { IamAdminModule } from './modules/iam-admin/iam-admin.module';
import { IamDatabaseModule } from './modules/iam-admin/iam-database.module';
import { UserModule } from './modules/user/user.module';
import { OAuthModule } from './modules/oauth/oauth.module';
import { IamContextModule } from './modules/iam-context/iam-context.module';
import { IamAuditModule } from './modules/audit/iam-audit.module';

@Module({
  imports: [IamDatabaseModule, IamAuditModule, HealthModule, AuthModule, UserModule, IamAdminModule, OAuthModule, IamContextModule],
})
export class AppModule {}
