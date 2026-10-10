import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

import { AppModule } from './app.module';

process.env.PORT ??= '3101';
loadEnv({ path: process.env.IAM_ENV_FILE ?? resolve(__dirname, '..', '..', '..', 'backend', '.env') });
if (process.env.NODE_ENV !== 'production' && !process.env.IAM_DB_DATABASE) {
  process.env.IAM_DB_DATABASE = 'iam_sso';
  process.env.IAM_DB_HOST ??= process.env.DB_HOST ?? '127.0.0.1';
  process.env.IAM_DB_PORT ??= process.env.DB_PORT ?? '3306';
  process.env.IAM_DB_USERNAME ??= process.env.DB_USERNAME ?? 'root';
  process.env.IAM_DB_PASSWORD ??= process.env.DB_PASSWORD ?? '';
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const corsOrigin = process.env.IAM_CORS_ORIGIN ?? 'http://localhost:6101,http://localhost:5998,http://localhost:5999,http://127.0.0.1:6101,http://127.0.0.1:5998,http://127.0.0.1:5999';
  const trustProxy = ['1', 'on', 'true', 'yes'].includes((process.env.IAM_TRUST_PROXY ?? '').trim().toLowerCase());

  if (trustProxy) app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.enableCors({
    credentials: true,
    origin: corsOrigin.split(',').map((item) => item.trim()),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  await app.listen(Number(process.env.PORT ?? 3101));
}

void bootstrap();
