import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

import { IamAuditService } from '../audit/iam-audit.service';
import type { AuthenticatedRequest } from '../auth/access-token.guard';

@Injectable()
export class IamAdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: IamAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!['POST', 'PUT'].includes(request.method)) return next.handle();

    return next.handle().pipe(
      tap(() => {
        const user = request.iamUser;
        void this.audit.record({
          action: 'iam.admin.write',
          actorUserId: user?.userId,
          details: { method: request.method, path: request.originalUrl ?? request.url },
          eventType: 'administration',
          outcome: 'success',
          username: user?.username,
        });
      }),
    );
  }
}
