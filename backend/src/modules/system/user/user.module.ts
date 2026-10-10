import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { SystemUserController } from './user.controller';
import { SystemUserService } from './user.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [SystemUserController],
  providers: [SystemUserService],
})
export class SystemUserModule {}
