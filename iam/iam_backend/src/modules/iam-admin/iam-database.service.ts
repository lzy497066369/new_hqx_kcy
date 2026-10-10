import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { IamAppEntity } from './entities/iam-app.entity';
import { IamCompanyMemberEntity } from './entities/iam-company-member.entity';
import { IamCompanyEntity } from './entities/iam-company.entity';
import { IamPlatformDepartmentEntity } from './entities/iam-platform-department.entity';
import { IamUserCompanyScopeEntity } from './entities/iam-user-company-scope.entity';
import { IamUserEntity } from './entities/iam-user.entity';
import { IamUserAppEntity } from './entities/iam-user-app.entity';
import { IamUserAppContextEntity } from './entities/iam-user-app-context.entity';
import { IamUserPlatformDepartmentEntity } from './entities/iam-user-platform-department.entity';
import { IamOAuthClientEntity } from './entities/iam-oauth-client.entity';
import { IamOAuthAuthorizationCodeEntity } from '../oauth/entities/iam-oauth-authorization-code.entity';
import { IamRefreshTokenEntity } from '../oauth/entities/iam-refresh-token.entity';
import { IamSsoSessionEntity } from '../oauth/entities/iam-sso-session.entity';
import { IamRoleEntity } from './entities/iam-role.entity';
import { IamPermissionEntity } from './entities/iam-permission.entity';
import { IamRolePermissionEntity } from './entities/iam-role-permission.entity';
import { IamUserRoleEntity } from './entities/iam-user-role.entity';
import { IamMenuEntity } from './entities/iam-menu.entity';
import { IamAuditEventEntity } from '../audit/entities/iam-audit-event.entity';
import { IamAdminSessionEntity } from '../auth/entities/iam-admin-session.entity';

@Injectable()
export class IamDatabaseService {
  private dataSource: DataSource | null = null;
  private initializing: Promise<DataSource> | null = null;

  async getDataSource(): Promise<DataSource> {
    if (this.dataSource?.isInitialized) return this.dataSource;
    if (!this.initializing) this.initializing = this.initialize();
    return this.initializing;
  }

  private async initialize(): Promise<DataSource> {
    const database = process.env.IAM_DB_DATABASE;
    if (!database) {
      throw new ServiceUnavailableException('IAM database is not configured');
    }

    const dataSource = new DataSource({
      charset: 'utf8mb4',
      database,
      entities: [
        IamAppEntity,
        IamUserEntity,
        IamCompanyEntity,
        IamCompanyMemberEntity,
        IamPlatformDepartmentEntity,
        IamUserCompanyScopeEntity,
        IamUserAppEntity,
        IamUserAppContextEntity,
        IamUserPlatformDepartmentEntity,
        IamOAuthClientEntity,
        IamOAuthAuthorizationCodeEntity,
        IamRefreshTokenEntity,
        IamSsoSessionEntity,
        IamRoleEntity,
        IamPermissionEntity,
        IamRolePermissionEntity,
        IamUserRoleEntity,
        IamMenuEntity,
        IamAuditEventEntity,
        IamAdminSessionEntity,
      ],
      host: process.env.IAM_DB_HOST ?? '127.0.0.1',
      password: process.env.IAM_DB_PASSWORD,
      port: Number(process.env.IAM_DB_PORT ?? 3306),
      synchronize: false,
      timezone: '+08:00',
      type: 'mysql',
      username: process.env.IAM_DB_USERNAME ?? 'root',
    });
    try {
      await dataSource.initialize();
      this.dataSource = dataSource;
      return dataSource;
    } catch (error) {
      this.initializing = null;
      throw error;
    }
  }
}
