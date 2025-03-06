import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
