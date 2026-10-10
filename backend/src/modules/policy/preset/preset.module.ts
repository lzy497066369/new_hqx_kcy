import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { AuthModule } from '../../auth/auth.module';
import { DeclarationPresetController } from './preset.controller';
import { DeclarationPresetService } from './preset.service';

@Module({
  controllers: [DeclarationPresetController],
  imports: [AuthModule, DatabaseModule],
  providers: [DeclarationPresetService],
  exports: [DeclarationPresetService],
})
export class DeclarationPresetModule {}
