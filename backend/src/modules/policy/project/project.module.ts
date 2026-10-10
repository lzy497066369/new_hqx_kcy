import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { ProjectMaterialRequirementController } from './material-requirement.controller';
import { PolicyProjectController } from './project.controller';
import { PolicyProjectService } from './project.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [PolicyProjectController, ProjectMaterialRequirementController],
  providers: [PolicyProjectService],
  exports: [PolicyProjectService],
})
export class PolicyProjectModule {}
