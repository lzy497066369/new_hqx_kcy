import { Global, Module } from '@nestjs/common';

import { IamDatabaseModule } from '../iam-admin/iam-database.module';
import { IamAuditService } from './iam-audit.service';

@Global()
@Module({ exports: [IamAuditService], imports: [IamDatabaseModule], providers: [IamAuditService] })
export class IamAuditModule {}
