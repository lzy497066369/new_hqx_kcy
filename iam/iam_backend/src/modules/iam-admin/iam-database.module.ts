import { Global, Module } from '@nestjs/common';

import { IamDatabaseService } from './iam-database.service';

@Global()
@Module({
  exports: [IamDatabaseService],
  providers: [IamDatabaseService],
})
export class IamDatabaseModule {}
