import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { SystemDeptController } from './dept.controller';
import { SystemDeptService } from './dept.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [SystemDeptController],
  providers: [SystemDeptService],
})
export class SystemDeptModule {}
