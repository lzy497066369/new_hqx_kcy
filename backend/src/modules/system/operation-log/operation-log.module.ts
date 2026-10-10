import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { OperationLogInterceptor } from '../../../common/interceptors/operation-log.interceptor';
import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { OperationLogRepository } from '../../../infrastructure/database/repositories/operation-log.repository';
import { SystemOperationLogController } from './operation-log.controller';
import { SystemOperationLogService } from './operation-log.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [SystemOperationLogController],
  providers: [
    SystemOperationLogService,
    OperationLogRepository,
    {
      provide: APP_INTERCEPTOR,
      useClass: OperationLogInterceptor,
    },
  ],
})
export class SystemOperationLogModule {}
