import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { SystemRoleController } from './role.controller';
import { SystemRoleService } from './role.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [SystemRoleController],
  providers: [SystemRoleService],
})
export class SystemRoleModule {}
