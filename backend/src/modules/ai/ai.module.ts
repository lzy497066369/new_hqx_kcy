import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { AiAuditLogEntity } from '../../infrastructure/database/entities/ai-audit-log.entity';
import { AiResultEntity } from '../../infrastructure/database/entities/ai-result.entity';
import { AiTaskEntity } from '../../infrastructure/database/entities/ai-task.entity';
import { RegionPolicyFileEntity } from '../../infrastructure/database/entities/region-policy-file.entity';
import { AiAuditLogService } from './ai-audit-log.service';
import { AiContextService } from './ai-context.service';
import { AiController } from './ai.controller';
import { AiGatewayService } from './ai-gateway.service';
import { AiResultService } from './ai-result.service';
import { AiService } from './ai.service';
import { AiTaskService } from './ai-task.service';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import { PolicyParseScene } from './scenes/policy-parse.scene';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      AiAuditLogEntity,
      AiResultEntity,
      AiTaskEntity,
      RegionPolicyFileEntity,
    ]),
  ],
  controllers: [AiController],
  providers: [
    AiAuditLogService,
    AiContextService,
    AiGatewayService,
    AiResultService,
    AiService,
    AiTaskService,
    OpenAiCompatibleProvider,
    PolicyParseScene,
  ],
  exports: [AiGatewayService, AiService],
})
export class AiModule {}
