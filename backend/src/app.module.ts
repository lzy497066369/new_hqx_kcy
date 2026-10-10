import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'node:path';

import { AppConfigModule } from './config/app-config.module';
import { RedisModule } from './infrastructure/cache/redis.module';
import { AiModule } from './modules/ai/ai.module';
import { ClientModule } from './modules/client/client.module';
import { ClientGovernanceModule } from './modules/client-governance/governance.module';
import { ClientPolicyConfigModule } from './modules/client-policy-config/client-policy-config.module';
import { CrmSyncModule } from './modules/crm-sync/crm-sync.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EnterpriseModule } from './modules/enterprise/enterprise.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { MenuModule } from './modules/menu/menu.module';
import { RegionPolicyFileModule } from './modules/policy/file/file.module';
import { PolicyCollectModule } from './modules/policy/collect/collect.module';
import { PolicyProjectModule } from './modules/policy/project/project.module';
import { DeclarationPresetModule } from './modules/policy/preset/preset.module';
import { PolicyRegionModule } from './modules/policy/region/region.module';
import { SystemDeptModule } from './modules/system/dept/dept.module';
import { SystemMenuModule } from './modules/system/menu/menu.module';
import { SystemOperationLogModule } from './modules/system/operation-log/operation-log.module';
import { SystemRoleModule } from './modules/system/role/role.module';
import { SystemUserModule } from './modules/system/user/user.module';
import { UploadModule } from './modules/upload/upload.module';
import { UserModule } from './modules/user/user.module';

const ENABLED_FLAGS = new Set(['1', 'on', 'true', 'yes']);

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: join(__dirname, '..', '.env'),
      isGlobal: true,
    }),
    // 全局请求限流保护
    ThrottlerModule.forRoot([{
      ttl: 60000,  // 60秒时间窗口
      limit: 100,  // 最多100次请求
    }]),
    AppConfigModule,
    RedisModule,
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: () => {
        const synchronize = ENABLED_FLAGS.has(
          String(process.env.DB_SYNCHRONIZE ?? '')
            .trim()
            .toLowerCase(),
        );

        return {
          autoLoadEntities: true,
          charset: 'utf8mb4',
          database: process.env.DB_DATABASE,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          host: process.env.DB_HOST,
          logging: false,
          synchronize,
          timezone: '+08:00',
          password: process.env.DB_PASSWORD,
          port: Number(process.env.DB_PORT ?? 3306),
          type: 'mysql',
          username: process.env.DB_USERNAME,
          // 数据库连接池配置
          extra: {
            connectionLimit: 10, // 连接池最大连接数
            waitForConnections: true,
            queueLimit: 0,
          },
          // 连接超时配置
          connectTimeout: 10000, // 10秒连接超时
          acquireTimeout: 10000, // 10秒获取连接超时
          // 空闲连接回收
          maxQueryExecutionTime: 30000, // 30秒查询超时（记录慢查询）
        };
      },
    }),
    HealthModule,
    AuthModule,
    AiModule,
    ClientModule,
    ClientGovernanceModule,
    ClientPolicyConfigModule,
    CrmSyncModule,
    DashboardModule,
    EnterpriseModule,
    UploadModule,
    UserModule,
    MenuModule,
    SystemUserModule,
    SystemRoleModule,
    SystemMenuModule,
    SystemDeptModule,
    SystemOperationLogModule,
    PolicyCollectModule,
    PolicyRegionModule,
    PolicyProjectModule,
    DeclarationPresetModule,
    RegionPolicyFileModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
