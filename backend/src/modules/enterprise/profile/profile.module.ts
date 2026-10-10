import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { EnterpriseAccountService } from '../shared/enterprise-account.service';
import { EnterpriseTeacherModule } from '../teacher/teacher.module';
import { EnterpriseProfileController } from './profile.controller';
import { EnterpriseProfileExcelService } from './profile-excel.service';
import { EnterpriseProfileService } from './profile.service';

@Module({
  imports: [AuthModule, DatabaseModule, EnterpriseTeacherModule],
  controllers: [EnterpriseProfileController],
  providers: [
    EnterpriseAccountService,
    EnterpriseProfileExcelService,
    EnterpriseProfileService,
  ],
  exports: [EnterpriseProfileService],
})
export class EnterpriseProfileModule {}
