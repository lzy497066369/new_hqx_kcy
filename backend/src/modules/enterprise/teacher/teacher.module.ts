import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { AuthModule } from '../../auth/auth.module';
import { EnterpriseTeacherController } from './teacher.controller';
import { EnterpriseTeacherService } from './teacher.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [EnterpriseTeacherController],
  providers: [EnterpriseTeacherService],
  exports: [EnterpriseTeacherService],
})
export class EnterpriseTeacherModule {}
