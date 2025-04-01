import { NestApplication } from '@nestjs/core';
import { ScyllaService } from '../../src/scylla/scylla.service';
import { RedisService } from '../../src/redis/redis.service';
import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { AdminModule } from '../../src/admin/admin.module';
import { ScyllaModule } from '../../src/scylla/scylla.module';
import { RedisModule } from '../../src/redis/redis.module';
import { WebsocketModule } from '../../src/websocket/websocket.module';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { CacheModule } from '@nestjs/cache-manager/dist/cache.module';
import { ConfigService } from '@nestjs/config/dist/config.service';
import { JwtMother } from '../fixture/jwt.mother';
import { RequestMother } from '../fixture/request.mother';
import * as request from 'supertest';

describe('/board e2e', () => {
  let app: NestApplication;
  let scyllaFactory: ScyllaService;
  let redisFactory: RedisService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.registerAsync({
          global: true,
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => ({
            secret: configService.get('JWT_SECRET'),
            signOptions: { expiresIn: '8h' },
          }),
          inject: [ConfigService],
        }),
        AdminModule,
        ScyllaModule,
        RedisModule,
        WebsocketModule,
        ConfigModule.forRoot({ isGlobal: true }),
        CacheModule.registerAsync({
          isGlobal: true,
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => ({
            host: configService.get('REDIS_HOST', 'redis'),
            port: configService.get('REDIS_PORT', 6379),
          }),
          inject: [ConfigService],
        }),
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    scyllaFactory = app.get(ScyllaService);
    redisFactory = app.get(RedisService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /pixel', () => {
    it('밴 당한 유저는 픽셀을 추가할 수 없다.', async () => {
      // given
      const bannedUserId = JwtMother.createUserId();

      // when
      await RequestMother.createAdminRequest(app, {
        url: '/admin/ban',
        method: 'post',
        token: JwtMother.create(),
      })
        .send({ userId: bannedUserId })
        .expect(201);

      await request(app.getHttpServer())
        .post('/board/pixel')
        .send({
          x: 0,
          y: 0,
          colorIndex: 0,
        })
        .set(
          'Authorization',
          `Bearer ${JwtMother.create({ sub: bannedUserId })}`,
        )
        .expect(403);
    });
  });
});
