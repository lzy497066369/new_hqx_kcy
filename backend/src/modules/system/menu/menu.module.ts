import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { SystemMenuController } from './menu.controller';
import { SystemMenuService } from './menu.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [SystemMenuController],
  providers: [SystemMenuService],
})
export class SystemMenuModule {}
