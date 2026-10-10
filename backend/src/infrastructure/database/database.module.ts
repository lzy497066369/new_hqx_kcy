import { HighTechApplicationEntity } from './entities/high-tech-application.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiDraftEntity } from './entities/ai-draft.entity';
import { AiResultEntity } from './entities/ai-result.entity';
import { AiTaskEntity } from './entities/ai-task.entity';
import { AppClientEntity } from './entities/app-client.entity';
import { AppEntity } from './entities/app.entity';
import { ClientUserProfileEntity } from './entities/client-user-profile.entity';
import { ClientDeclarationEntity } from './entities/client-declaration.entity';
import { CrmContractSyncRecordEntity } from './entities/crm-contract-sync-record.entity';
import { CrmExecutionOrderSyncRecordEntity } from './entities/crm-execution-order-sync-record.entity';
import { CrmIntegrationClientEntity } from './entities/crm-integration-client.entity';
import { CrmIntegrationInboundRequestEntity } from './entities/crm-integration-inbound-request.entity';
import { CrmIntegrationKeyEntity } from './entities/crm-integration-key.entity';
import { CrmIntegrationNonceEntity } from './entities/crm-integration-nonce.entity';
import { CrmIntegrationOutboxTaskEntity } from './entities/crm-integration-outbox-task.entity';
import { CrmSyncAttemptLogEntity } from './entities/crm-sync-attempt-log.entity';
import { DeclarationSchemeEntity } from './entities/declaration-scheme.entity';
import { DeclarationPresetEntity } from './entities/declaration-preset.entity';
import { DeclarationMaterialCheckEntity } from './entities/declaration-material-check.entity';
import { DeclarationMaterialCheckItemEntity } from './entities/declaration-material-check-item.entity';
import { EnterpriseAccountRecordEntity } from './entities/enterprise-account-record.entity';
import { EnterpriseCertificateRecordEntity } from './entities/enterprise-certificate-record.entity';
import { EnterpriseContractRecordEntity } from './entities/enterprise-contract-record.entity';
import { EnterpriseDocumentRecordEntity } from './entities/enterprise-document-record.entity';
import { EnterpriseEmployeeRecordEntity } from './entities/enterprise-employee-record.entity';
import { EnterpriseEntity } from './entities/enterprise.entity';
import { EnterpriseBasicInfoEntity } from './entities/enterprise-basic-info.entity';
import { EnterpriseContactEntity } from './entities/enterprise-contact.entity';
import { EnterpriseFinanceRecordEntity } from './entities/enterprise-finance-record.entity';
import { EnterpriseMaterialEntity } from './entities/enterprise-material.entity';
import { EnterpriseMaterialParseErrorEntity } from './entities/enterprise-material-parse-error.entity';
import { EnterpriseOwnerEntity } from './entities/enterprise-owner.entity';
import { EnterprisePhotoRecordEntity } from './entities/enterprise-photo-record.entity';
import { EnterpriseProfileStatEntity } from './entities/enterprise-profile-stat.entity';
import { EnterpriseProfileStatItemEntity } from './entities/enterprise-profile-stat-item.entity';
import { EnterprisePersonEntity } from './entities/enterprise-person.entity';
import { EnterprisePropertyRecordEntity } from './entities/enterprise-property-record.entity';
import { EnterpriseTeacherEntity } from './entities/enterprise-teacher.entity';
import { EnterpriseUserEntity } from './entities/enterprise-user.entity';
import { GaoxinBookDraftEntity } from './entities/gaoxin-book-draft.entity';
import { MenuEntity } from './entities/menu.entity';
import { OperationLogEntity } from './entities/operation-log.entity';
import { PolicyProjectEntity } from './entities/policy-project.entity';
import { PolicyCollectJobEntity } from './entities/policy-collect-job.entity';
import { PolicyCollectNotificationEntity } from './entities/policy-collect-notification.entity';
import { PolicyCollectRunEntity } from './entities/policy-collect-run.entity';
import { PolicyCollectRunItemEntity } from './entities/policy-collect-run-item.entity';
import { DeptEntity } from './entities/dept.entity';
import { PermissionEntity } from './entities/permission.entity';
import { RegionPolicyFileEntity } from './entities/region-policy-file.entity';
import { RegionEntity } from './entities/region.entity';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { RoleEntity } from './entities/role.entity';
import { ProjectMaterialRequirementEntity } from './entities/project-material-requirement.entity';
import { ProjectMaterialRequirementItemEntity } from './entities/project-material-requirement-item.entity';
import { TianyanchaApiCallLogEntity } from './entities/tianyancha-api-call-log.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { UserEntity } from './entities/user.entity';
import { UserAppEntity } from './entities/user-app.entity';
import { MenuRepository } from './repositories/menu.repository';
import { OperationLogRepository } from './repositories/operation-log.repository';
import { DeptRepository } from './repositories/dept.repository';
import { PermissionRepository } from './repositories/permission.repository';
import { RoleRepository } from './repositories/role.repository';
import { UserRepository } from './repositories/user.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HighTechApplicationEntity,
      UserEntity,
      UserAppEntity,
      RoleEntity,
      UserRoleEntity,
      PermissionEntity,
      RolePermissionEntity,
      DeptEntity,
      MenuEntity,
      OperationLogEntity,
      AiDraftEntity,
      AiResultEntity,
      AiTaskEntity,
      ClientDeclarationEntity,
      CrmContractSyncRecordEntity,
      CrmExecutionOrderSyncRecordEntity,
      CrmIntegrationClientEntity,
      CrmIntegrationInboundRequestEntity,
      CrmIntegrationKeyEntity,
      CrmIntegrationNonceEntity,
      CrmIntegrationOutboxTaskEntity,
      CrmSyncAttemptLogEntity,
      DeclarationSchemeEntity,
      DeclarationPresetEntity,
      ClientUserProfileEntity,
      DeclarationMaterialCheckEntity,
      DeclarationMaterialCheckItemEntity,
      EnterpriseAccountRecordEntity,
      EnterpriseEntity,
      EnterpriseBasicInfoEntity,
      EnterpriseCertificateRecordEntity,
      EnterpriseContactEntity,
      EnterpriseContractRecordEntity,
      EnterpriseDocumentRecordEntity,
      EnterpriseEmployeeRecordEntity,
      EnterpriseFinanceRecordEntity,
      EnterpriseMaterialEntity,
      EnterpriseMaterialParseErrorEntity,
      EnterpriseOwnerEntity,
      EnterprisePhotoRecordEntity,
      EnterpriseProfileStatEntity,
      EnterpriseProfileStatItemEntity,
      EnterprisePersonEntity,
      EnterprisePropertyRecordEntity,
      EnterpriseTeacherEntity,
      EnterpriseUserEntity,
      GaoxinBookDraftEntity,
      RegionEntity,
      PolicyCollectJobEntity,
      PolicyCollectNotificationEntity,
      PolicyCollectRunEntity,
      PolicyCollectRunItemEntity,
      PolicyProjectEntity,
      ProjectMaterialRequirementEntity,
      ProjectMaterialRequirementItemEntity,
      RegionPolicyFileEntity,
      TianyanchaApiCallLogEntity,
      AppEntity,
      AppClientEntity,
    ]),
  ],
  providers: [
    UserRepository,
    RoleRepository,
    PermissionRepository,
    DeptRepository,
    MenuRepository,
    OperationLogRepository,
  ],
  exports: [
    TypeOrmModule,
    UserRepository,
    RoleRepository,
    PermissionRepository,
    DeptRepository,
    MenuRepository,
    OperationLogRepository,
  ],
})
export class DatabaseModule {}
