import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { AdminModule } from '../../src/admin/admin.module';
import { ScyllaModule } from '../../src/scylla/scylla.module';
import { RedisModule } from '../../src/redis/redis.module';
import { WebsocketModule } from '../../src/websocket/websocket.module';
import { ScyllaService } from '../../src/scylla/scylla.service';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { CacheModule } from '@nestjs/cache-manager/dist/cache.module';
import { ConfigService } from '@nestjs/config/dist/config.service';
import { NestApplication } from '@nestjs/core';
import { JwtMother } from '../fixture/jwt.mother';
import { BoardMother } from '../fixture/board.mother';
import { RedisService } from '../../src/redis/redis.service';
import { ByteUtility } from '../../src/common/utils/byte.utility';
import { RequestMother } from '../fixture/request.mother';
import * as request from 'supertest';
import { as } from '@faker-js/faker/dist/airline-CBNP41sR';
import { faker } from '@faker-js/faker';
import { SchemaObjectFactory } from '@nestjs/swagger/dist/services/schema-object-factory';

describe('/admin e2e', () => {
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
    await redisFactory.getClient().flushall();
    await scyllaFactory.flushTestDB();
    await app.close();
  });

  describe('GET /board', () => {});
  describe('GET /board/:id', () => {});
  describe('GET /snapshot-ids', () => {});
  describe('GET /pixel-history (특정 픽셀 기록 조회)', () => {});
  describe('GET /pixel-history-length', () => {});
  describe('GET /pixel-history-all', () => {});
  describe('GET /user-count', () => {});
  describe('GET /snapshot-count', () => {});
  describe('GET /board-size', () => {});
  describe('POST /initialize', () => {});
  describe('POST /reset', () => {
    it('보드 초기화', async () => {
      const token = JwtMother.create();
      await redisFactory.setBoard(BoardMother.createRandom());

      await RequestMother.createAdminRequest(app, {
        url: '/admin/reset',
        method: 'post',
        token,
      }).expect(201);

      const response = await RequestMother.createAdminRequest(app, {
        url: '/board',
        method: 'get',
        token,
      }).expect(200);
      const boardLength = ByteUtility.removeEmptyBytes(response.body).length;
      expect(boardLength).toBe(0);
    });
  });
  describe('POST /random', () => {});
  describe('POST /cooldown', () => {
    it('쿨다운 설정', async () => {
      const userId = JwtMother.createUserId();
      const cooldown = 1000;
      await RequestMother.createAdminRequest(app, {
        url: '/admin/cooldown',
        method: 'post',
        token: JwtMother.create(),
      })
        .send({ cooldown })
        .expect(201);

      await request(app.getHttpServer())
        .post('/board/pixel')
        .send({
          x: 0,
          y: 0,
          colorIndex: 1,
        })
        .set('Authorization', `Bearer ${JwtMother.create({ sub: userId })}`)
        .expect(201);
      await request(app.getHttpServer())
        .post('/board/pixel')
        .send({
          x: 0,
          y: 0,
          colorIndex: 2,
        })
        .set('Authorization', `Bearer ${JwtMother.create({ sub: userId })}`)
        .expect(500);

      const { body } = await request(app.getHttpServer())
        .get(`/board/pixel?x=0&y=0`)
        .expect(200);
      expect(body.colorIndex).toBe(1);
    });
  });
  describe('POST /ban', () => {
    it('유저를 밴한다.', async () => {
      const userId = JwtMother.createUserId();

      await RequestMother.createAdminRequest(app, {
        url: '/admin/ban',
        method: 'post',
        token: JwtMother.create({ sub: userId }),
      })
        .send({ userId })
        .expect(201);

      const isBanned = await redisFactory.getBanUser(userId);
      expect(isBanned).toBeTruthy();
    });
  });
  describe('GET /ban-all', () => {
    it('밴된 유저를 조회한다.', async () => {
      // given
      const userId = JwtMother.createUserId();

      await RequestMother.createAdminRequest(app, {
        url: '/admin/ban',
        method: 'post',
        token: JwtMother.create({ sub: userId }),
      })
        .send({ userId })
        .expect(201);

      // when
      const response = await RequestMother.createAdminRequest(app, {
        url: '/admin/ban-all',
        method: 'get',
        token: JwtMother.create(),
      }).expect(200);

      // then
      expect(response.body).toEqual([userId]);
    });

    it('밴된 유저들을 조회한다.', async () => {
      // given
      const userId1 = JwtMother.createUserId();
      const userId2 = JwtMother.createUserId();
      await Promise.all([
        RequestMother.createAdminRequest(app, {
          url: '/admin/ban',
          method: 'post',
          token: JwtMother.create({ sub: userId1 }),
        })
          .send({ userId: userId1 })
          .expect(201),
        RequestMother.createAdminRequest(app, {
          url: '/admin/ban',
          method: 'post',
          token: JwtMother.create({ sub: userId2 }),
        })
          .send({ userId: userId2 })
          .expect(201),
      ]);

      // when
      const response = await RequestMother.createAdminRequest(app, {
        url: '/admin/ban-all',
        method: 'get',
        token: JwtMother.create(),
      }).expect(200);

      // then
      expect(response.body).toContain(userId1);
      expect(response.body).toContain(userId2);
      expect(response.body).toHaveLength(2);
    });
    describe('DELETE /ban', () => {
      it('블랙리스트에서 삭제한다.', async () => {
        // given
        const userId = JwtMother.createUserId();

        await RequestMother.createAdminRequest(app, {
          url: '/admin/ban',
          method: 'post',
          token: JwtMother.create({ sub: userId }),
        })
          .send({ userId })
          .expect(201);

        // when
        const response = await RequestMother.createAdminRequest(app, {
          url: '/admin/ban-all',
          method: 'get',
          token: JwtMother.create(),
        }).expect(200);

        // then
        expect(response.body).toEqual([userId]);
      });
    });
    describe('POST /set-area', () => {});
    describe('POST /rollback/:id', () => {
      it('특정 스냅샷으로 롤백한다.', async () => {
        // given
        await scyllaFactory.saveBoardSnapshot(BoardMother.createRandom());
        await scyllaFactory.saveBoardSnapshot(BoardMother.createRandom());
        await redisFactory.setBoard(BoardMother.createRandom());

        const snapshots = await scyllaFactory.getSnapshotIds();
        const rollbackPointSnapshotId = snapshots[0].snapshotId;

        // when
        await RequestMother.createAdminRequest(app, {
          url: `/admin/rollback/${rollbackPointSnapshotId}`,
          method: 'post',
          token: JwtMother.create(),
        }).expect(201);

        // then
        const [rollbackBoard, currentBoard] = await Promise.all([
          scyllaFactory.getBoardBySnapshotId(rollbackPointSnapshotId),
          redisFactory.getFullBoard(),
        ]);

        expect(currentBoard).toStrictEqual(rollbackBoard);
      });

      it('롤백 직전에 스냅샷을 저장한다.', async () => {
        // given
        await scyllaFactory.saveBoardSnapshot(BoardMother.createRandom());
        await scyllaFactory.saveBoardSnapshot(BoardMother.createRandom());

        const expectLastSnapshot = BoardMother.createRandom();
        await redisFactory.setBoard(expectLastSnapshot);

        const snapshots = await scyllaFactory.getSnapshotIds();
        const rollbackPointSnapshotId = snapshots[0].snapshotId;

        // when
        await RequestMother.createAdminRequest(app, {
          url: `/admin/rollback/${rollbackPointSnapshotId}`,
          method: 'post',
          token: JwtMother.create(),
        }).expect(201);

        // then
        const snapshotIds = await scyllaFactory.getSnapshotIds();
        const lastSnapshot = await scyllaFactory.getBoardBySnapshotId(
          snapshotIds[snapshotIds.length - 1].snapshotId,
        );

        expect(snapshotIds).toHaveLength(3);
        expect(expectLastSnapshot).toStrictEqual(lastSnapshot);
      });
    });
  });
});
