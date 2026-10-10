import { Module } from '@nestjs/common';

import { EnterpriseClientModule } from './client/client.module';
import { EnterpriseImportModule } from './import/import.module';
import { EnterpriseOwnerModule } from './owner/owner.module';
import { EnterpriseProfileModule } from './profile/profile.module';
import { EnterpriseTeacherModule } from './teacher/teacher.module';
import { EnterpriseUserModule } from './user/user.module';
import { EnterpriseWorkspaceModule } from './workspace/workspace.module';

@Module({
  imports: [
    EnterpriseProfileModule,
    EnterpriseImportModule,
    EnterpriseOwnerModule,
    EnterpriseUserModule,
    EnterpriseTeacherModule,
    EnterpriseClientModule,
    EnterpriseWorkspaceModule,
  ],
})
export class EnterpriseModule {}
