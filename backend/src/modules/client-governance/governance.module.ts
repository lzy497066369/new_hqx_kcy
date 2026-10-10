import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { EnterpriseEntity } from '../../infrastructure/database/entities/enterprise.entity';
import { EnterpriseTeacherEntity } from '../../infrastructure/database/entities/enterprise-teacher.entity';
import { EnterpriseOwnerEntity } from '../../infrastructure/database/entities/enterprise-owner.entity';
import { RegionEntity } from '../../infrastructure/database/entities/region.entity';
import { RoleEntity } from '../../infrastructure/database/entities/role.entity';
import { UserAppEntity } from '../../infrastructure/database/entities/user-app.entity';
import { UserEntity } from '../../infrastructure/database/entities/user.entity';
import { UserRoleEntity } from '../../infrastructure/database/entities/user-role.entity';
import { ClientGovernanceController } from './governance.controller';
import { ClientGovernanceExcelService } from './governance-excel.service';
import { ClientGovernanceService } from './governance.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([EnterpriseEntity, EnterpriseTeacherEntity, EnterpriseOwnerEntity, RegionEntity, RoleEntity, UserAppEntity, UserEntity, UserRoleEntity])],
  controllers: [ClientGovernanceController],
  providers: [ClientGovernanceService, ClientGovernanceExcelService],
})
export class ClientGovernanceModule {}
