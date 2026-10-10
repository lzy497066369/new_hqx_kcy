import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClientDeclarationEntity } from '../../../infrastructure/database/entities/client-declaration.entity';
import { EnterpriseContactEntity } from '../../../infrastructure/database/entities/enterprise-contact.entity';
import { EnterpriseBasicInfoEntity } from '../../../infrastructure/database/entities/enterprise-basic-info.entity';
import { EnterprisePersonEntity } from '../../../infrastructure/database/entities/enterprise-person.entity';
import { EnterpriseFinanceRecordEntity } from '../../../infrastructure/database/entities/enterprise-finance-record.entity';
import { EnterpriseEmployeeRecordEntity } from '../../../infrastructure/database/entities/enterprise-employee-record.entity';
import { EnterpriseProfileStatEntity } from '../../../infrastructure/database/entities/enterprise-profile-stat.entity';
import { EnterpriseProfileStatItemEntity } from '../../../infrastructure/database/entities/enterprise-profile-stat-item.entity';
import { EnterprisePropertyRecordEntity } from '../../../infrastructure/database/entities/enterprise-property-record.entity';
import { EnterpriseAccountRecordEntity } from '../../../infrastructure/database/entities/enterprise-account-record.entity';
import { EnterpriseCertificateRecordEntity } from '../../../infrastructure/database/entities/enterprise-certificate-record.entity';
import { EnterpriseContractRecordEntity } from '../../../infrastructure/database/entities/enterprise-contract-record.entity';
import { EnterpriseDocumentRecordEntity } from '../../../infrastructure/database/entities/enterprise-document-record.entity';
import { EnterprisePhotoRecordEntity } from '../../../infrastructure/database/entities/enterprise-photo-record.entity';
import { EnterpriseMaterialParseErrorEntity } from '../../../infrastructure/database/entities/enterprise-material-parse-error.entity';
import { EnterpriseMaterialEntity } from '../../../infrastructure/database/entities/enterprise-material.entity';
import { DeclarationMaterialCheckEntity } from '../../../infrastructure/database/entities/declaration-material-check.entity';
import { DeclarationSchemeEntity } from '../../../infrastructure/database/entities/declaration-scheme.entity';
import { DeclarationPresetEntity } from '../../../infrastructure/database/entities/declaration-preset.entity';
import { PolicyProjectEntity } from '../../../infrastructure/database/entities/policy-project.entity';
import { RegionPolicyFileEntity } from '../../../infrastructure/database/entities/region-policy-file.entity';
import { RegionEntity } from '../../../infrastructure/database/entities/region.entity';
import { OperationLogEntity } from '../../../infrastructure/database/entities/operation-log.entity';
import { AuthModule } from '../../auth/auth.module';
import { ClientModule } from '../../client/client.module';
import { EnterpriseProfileModule } from '../profile/profile.module';
import { EnterpriseWorkspaceController } from './workspace.controller';
import { EnterpriseWorkspaceService } from './workspace.service';

@Module({
  imports: [
    AuthModule,
    ClientModule,
    EnterpriseProfileModule,
    TypeOrmModule.forFeature([
      ClientDeclarationEntity,
      EnterpriseContactEntity,
      EnterpriseBasicInfoEntity,
      EnterprisePersonEntity,
      EnterpriseFinanceRecordEntity,
      EnterpriseEmployeeRecordEntity,
      EnterpriseProfileStatEntity,
      EnterpriseProfileStatItemEntity,
      EnterprisePropertyRecordEntity,
      EnterpriseAccountRecordEntity,
      EnterpriseCertificateRecordEntity,
      EnterpriseContractRecordEntity,
      EnterpriseDocumentRecordEntity,
      EnterprisePhotoRecordEntity,
      EnterpriseMaterialParseErrorEntity,
      EnterpriseMaterialEntity,
      DeclarationMaterialCheckEntity,
      DeclarationSchemeEntity,
      DeclarationPresetEntity,
      PolicyProjectEntity,
      RegionPolicyFileEntity,
      RegionEntity,
      OperationLogEntity,
    ]),
  ],
  controllers: [EnterpriseWorkspaceController],
  providers: [EnterpriseWorkspaceService],
})
export class EnterpriseWorkspaceModule {}
