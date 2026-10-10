import { Module } from '@nestjs/common';

import { OAuthModule } from '../oauth/oauth.module';
import { IamContextController } from './iam-context.controller';
import { IamContextService } from './iam-context.service';

@Module({
  controllers: [IamContextController],
  imports: [OAuthModule],
  providers: [IamContextService],
})
export class IamContextModule {}
