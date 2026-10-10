import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { EnterpriseProfileModule } from '../profile/profile.module';
import { EnterpriseClientController } from './client.controller';
import { EnterpriseClientService } from './client.service';

@Module({
  imports: [AuthModule, DatabaseModule, EnterpriseProfileModule],
  controllers: [EnterpriseClientController],
  providers: [EnterpriseClientService],
})
export class EnterpriseClientModule {}
