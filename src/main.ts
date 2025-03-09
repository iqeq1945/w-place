import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  // ValidationPipe를 글로벌로 설정
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // DTO로 자동 변환
      whitelist: true, // 정의되지 않은 속성 제거
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('w-place api')
    .setDescription('The API description')
    .setVersion('1.0')
    .addTag('w-place')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
