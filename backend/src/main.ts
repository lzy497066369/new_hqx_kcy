import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import { join } from 'node:path';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ensureUploadRootDirectory, getUploadRootAbsolutePath } from './common/utils/upload.util';
import { createWinstonConfig } from './config/winston.config';
import { highTechDraftBodyParser } from './modules/client/high-tech/high-tech-body-parser';

function resolveCorsOrigins(): boolean | string[] {
  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  if (process.env.NODE_ENV !== 'production') {
    return [
      'http://127.0.0.1:5998',
      'http://127.0.0.1:5999',
      'http://localhost:5998',
      'http://localhost:5999',
    ];
  }

  return false;
}

async function bootstrap() {
  // 安全检查：验证JWT密钥配置
  const authMode = process.env.AUTH_TOKEN_MODE;
  if (authMode === 'jwt') {
    if (!process.env.AUTH_JWT_PRIVATE_KEY || !process.env.AUTH_JWT_PUBLIC_KEY) {
      throw new Error(
        'JWT模式需要配置 AUTH_JWT_PRIVATE_KEY 和 AUTH_JWT_PUBLIC_KEY 环境变量'
      );
    }
  }

  // 创建应用实例，集成Winston日志系统
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      credentials: true,
      origin: resolveCorsOrigins(),
    },
    rawBody: true,
    logger: WinstonModule.createLogger(createWinstonConfig()),
  });

  app.use(highTechDraftBodyParser);

  app.useGlobalPipes(
    new ValidationPipe({
      forbidUnknownValues: false,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const uploadRoot = ensureUploadRootDirectory() || getUploadRootAbsolutePath();
  app.useStaticAssets(join(uploadRoot, 'policy'), {
    prefix: '/uploads/policy/',
  });
  app.useStaticAssets(join(uploadRoot, 'user', 'avatar'), {
    prefix: '/uploads/user/avatar/',
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('new_kjqb backend')
    .setDescription('Backend API for new_kjqb')
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

bootstrap();
