import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { AdminModule } from '../../src/admin/admin.module';
import { ScyllaModule } from '../../src/scylla/scylla.module';
import { RedisModule } from '../../src/redis/redis.module';
import { WebsocketModule } from '../../src/websocket/websocket.module';
import { ScyllaService } from '../../src/scylla/scylla.service';
import { PixelHistoryMother } from '../fixture/pixel-history.mother';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { CacheModule } from '@nestjs/cache-manager/dist/cache.module';
import { ConfigService } from '@nestjs/config/dist/config.service';

describe('/admin e2e', () => {
  let scyllaFactory: ScyllaService;
  beforeEach(async () => {
    const moduleBuilder = await Test.createTestingModule({
      imports: [
        JwtModule.register({}),
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

    const app = moduleBuilder.createNestApplication();
    await app.init();
    scyllaFactory = app.get(ScyllaService);
  });

  describe('/pixel-history-all', () => {
    it('should return 200', async () => {
      await scyllaFactory.batchInsertPixelHistory([
        PixelHistoryMother.createPixelHistory(),
      ]);

      expect(await scyllaFactory.getPixelHistoryAll()).toHaveLength(1);
    });
  });
});
