import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Express } from 'express';

import { AppModule } from './app.module';

// Vercel 서버리스용 Nest 부트스트랩.
// warm 인스턴스 간 재사용(cached)하여 콜드스타트를 줄인다.
// api/index.js가 이 컴파일된 dist/vercel.js를 require → 데코레이터 메타데이터 보존.
let cached: Express | null = null;

export async function bootstrapServerless(): Promise<Express> {
  if (cached) return cached;
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  cached = app.getHttpAdapter().getInstance() as Express;
  return cached;
}

export default async function handler(
  req: unknown,
  res: unknown,
): Promise<void> {
  const server = await bootstrapServerless();
  (server as unknown as (req: unknown, res: unknown) => void)(req, res);
}
