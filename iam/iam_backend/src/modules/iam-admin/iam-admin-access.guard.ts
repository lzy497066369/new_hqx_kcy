import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { IamRoleEntity } from './entities/iam-role.entity';
import { IamUserEntity } from './entities/iam-user.entity';
import { IamUserRoleEntity } from './entities/iam-user-role.entity';
import { IamDatabaseService } from './iam-database.service';

import type { AuthenticatedRequest } from '../auth/access-token.guard';

@Injectable()
export class IamAdminAccessGuard implements CanActivate {
  constructor(private readonly database: IamDatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.iamUser?.userId;
    if (!userId || userId === 'bootstrap-admin') {
      if (userId === 'bootstrap-admin') return true;
      throw new ForbiddenException('IAM administrator permission is required');
    }

    const dataSource = await this.database.getDataSource();
    const user = await dataSource
      .getRepository(IamUserEntity)
      .findOne({ where: { id: userId, status: 1 } });
    if (!user) throw new ForbiddenException('IAM administrator permission is required');

    const assignments = await dataSource
      .getRepository(IamUserRoleEntity)
      .find({ where: { appCode: 'iam_admin', userId } });
    const roles = assignments.length
      ? await dataSource
          .getRepository(IamRoleEntity)
          .findByIds(assignments.map((assignment) => assignment.roleId))
      : [];
    if (!roles.some((role) => role.status === 1 && role.appCode === 'iam_admin' && role.roleCode === 'super_admin')) {
      throw new ForbiddenException('IAM administrator permission is required');
    }
    return true;
  }
}
