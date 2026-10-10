import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeclarationPresetEntity } from '../../infrastructure/database/entities/declaration-preset.entity';
import { DeclarationSchemeEntity } from '../../infrastructure/database/entities/declaration-scheme.entity';
import { PolicyProjectEntity } from '../../infrastructure/database/entities/policy-project.entity';
import { ProjectMaterialRequirementEntity } from '../../infrastructure/database/entities/project-material-requirement.entity';
import { ProjectMaterialRequirementItemEntity } from '../../infrastructure/database/entities/project-material-requirement-item.entity';
import { RegionEntity } from '../../infrastructure/database/entities/region.entity';
import { ClientPolicyConfigService } from './client-policy-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([RegionEntity, PolicyProjectEntity, ProjectMaterialRequirementEntity, ProjectMaterialRequirementItemEntity, DeclarationSchemeEntity, DeclarationPresetEntity])],
  providers: [ClientPolicyConfigService],
})
export class ClientPolicyConfigModule {}
