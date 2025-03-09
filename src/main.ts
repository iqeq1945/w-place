import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as session from 'express-session';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
    }),
  );

  // ValidationPipe를 글로벌로 설정
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // DTO로 자동 변환
      whitelist: true, // 정의되지 않은 속성 제거
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
