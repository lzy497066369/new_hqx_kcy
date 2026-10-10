import { HighTechController } from './high-tech/high-tech.controller';
import { HighTechService } from './high-tech/high-tech.service';
import { HighTechIpRecognitionService } from './high-tech/high-tech-ip-recognition.service';
import { HighTechFieldRecommendationService } from './high-tech/high-tech-field-recommendation.service';
import { HighTechIpAllocationService } from './high-tech/high-tech-ip-allocation.service';
import { HighTechNameGenerationService } from './high-tech/high-tech-name-generation.service';
import { HighTechMaterialService } from './high-tech/high-tech-material.service';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { EnterpriseProfileModule } from '../enterprise/profile/profile.module';
import { ClientController } from './client.controller';
import { DeclarationReminderScheduler } from './declaration-reminder.scheduler';
import { ClientService } from './client.service';
import { EnterpriseArchiveService } from './enterprise-archive.service';
import {
  ClientDeclarationService,
  ClientProfileService,
  ClientFinanceService,
  ClientMaterialService,
  ClientPropertyService,
  ClientEmployeeService,
  ClientServiceFacade,
} from './services';

@Module({
  imports: [AiModule, AuthModule, DatabaseModule, EnterpriseProfileModule],
  controllers: [ClientController, HighTechController],
  exports: [
    ClientService, // 保留旧服务以保持兼容性
    ClientServiceFacade, // 新的门面服务
    // 也可以单独导出子服务供其他模块使用
    ClientDeclarationService,
    ClientProfileService,
    ClientFinanceService,
    ClientMaterialService,
    ClientPropertyService,
    ClientEmployeeService,
  ],
  providers: [
    EnterpriseArchiveService,
    HighTechIpRecognitionService,
    HighTechFieldRecommendationService,
    HighTechIpAllocationService,
    HighTechNameGenerationService,
    HighTechMaterialService,
    HighTechService,
    ClientService, // 保留旧服务
    DeclarationReminderScheduler,
    // 新的子服务
    ClientDeclarationService,
    ClientProfileService,
    ClientFinanceService,
    ClientMaterialService,
    ClientPropertyService,
    ClientEmployeeService,
    ClientServiceFacade,
  ],
})
export class ClientModule {}
