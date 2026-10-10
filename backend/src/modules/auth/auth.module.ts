import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module';
import { MemorySessionStore } from '../../infrastructure/cache/memory-session.store';
import { RedisClientService } from '../../infrastructure/cache/redis-client.service';
import { RedisSessionStore } from '../../infrastructure/cache/redis-session.store';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { PortalGuard } from '../../common/guards/portal.guard';
import { IamCompanyScopeService } from '../../common/auth/iam-company-scope.service';
import { AuthController } from './auth.controller';
import { AuthJwtService } from './auth-jwt.service';
import { AuthService } from './auth.service';
import { LoginThrottleService } from './login-throttle.service';
import { SessionStore } from './session-store.port';
import { resolveAuthRuntimeConfig } from './auth-runtime.config';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthJwtService,
    LoginThrottleService,
    AccessTokenGuard,
    MemorySessionStore,
    RedisSessionStore,
    PermissionGuard,
    PortalGuard,
    IamCompanyScopeService,
    {
      provide: SessionStore,
      inject: [
        MemorySessionStore,
        RedisSessionStore,
        RedisClientService,
        AuthJwtService,
      ],
      useFactory: (
        memorySessionStore: MemorySessionStore,
        redisSessionStore: RedisSessionStore,
        redisClient: RedisClientService,
        jwtService: AuthJwtService,
      ) => {
        const { sessionStore, tokenMode } = resolveAuthRuntimeConfig();
        if (tokenMode !== 'legacy' && sessionStore !== 'redis') {
          throw new Error(
            'AUTH_TOKEN_MODE=jwt or dual requires AUTH_SESSION_STORE=redis',
          );
        }
        if (sessionStore === 'redis') {
          if (!redisClient.isEnabled()) {
            throw new Error(
              'AUTH_SESSION_STORE=redis requires REDIS_ENABLED=true',
            );
          }
          if (tokenMode !== 'legacy') {
            jwtService.assertReady();
          }
          return redisSessionStore;
        }

        return memorySessionStore;
      },
    },
  ],
  exports: [
    DatabaseModule,
    AuthService,
    AuthJwtService,
    AccessTokenGuard,
    IamCompanyScopeService,
    PermissionGuard,
    PortalGuard,
    SessionStore,
  ],
})
export class AuthModule {}
