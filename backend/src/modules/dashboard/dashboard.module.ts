import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClientDeclarationEntity } from '../../infrastructure/database/entities/client-declaration.entity';
import { ClientUserProfileEntity } from '../../infrastructure/database/entities/client-user-profile.entity';
import { EnterpriseEmployeeRecordEntity } from '../../infrastructure/database/entities/enterprise-employee-record.entity';
import { EnterpriseEntity } from '../../infrastructure/database/entities/enterprise.entity';
import { EnterpriseFinanceRecordEntity } from '../../infrastructure/database/entities/enterprise-finance-record.entity';
import { EnterpriseMaterialEntity } from '../../infrastructure/database/entities/enterprise-material.entity';
import { EnterpriseOwnerEntity } from '../../infrastructure/database/entities/enterprise-owner.entity';
import { EnterpriseProfileStatEntity } from '../../infrastructure/database/entities/enterprise-profile-stat.entity';
import { EnterpriseProfileStatItemEntity } from '../../infrastructure/database/entities/enterprise-profile-stat-item.entity';
import { EnterprisePropertyRecordEntity } from '../../infrastructure/database/entities/enterprise-property-record.entity';
import { EnterpriseTeacherEntity } from '../../infrastructure/database/entities/enterprise-teacher.entity';
import { EnterpriseUserEntity } from '../../infrastructure/database/entities/enterprise-user.entity';
import { OperationLogEntity } from '../../infrastructure/database/entities/operation-log.entity';
import { PolicyProjectEntity } from '../../infrastructure/database/entities/policy-project.entity';
import { RegionPolicyFileEntity } from '../../infrastructure/database/entities/region-policy-file.entity';
import { UserEntity } from '../../infrastructure/database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { PolicyCollectModule } from '../policy/collect/collect.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    AuthModule,
    PolicyCollectModule,
    TypeOrmModule.forFeature([
      ClientDeclarationEntity,
      ClientUserProfileEntity,
      EnterpriseEmployeeRecordEntity,
      EnterpriseEntity,
      EnterpriseFinanceRecordEntity,
      EnterpriseMaterialEntity,
      EnterpriseOwnerEntity,
      EnterpriseProfileStatEntity,
      EnterpriseProfileStatItemEntity,
      EnterprisePropertyRecordEntity,
      EnterpriseTeacherEntity,
      EnterpriseUserEntity,
      OperationLogEntity,
      PolicyProjectEntity,
      RegionPolicyFileEntity,
      UserEntity,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
