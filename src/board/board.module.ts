import { Module } from '@nestjs/common';
import { BoardController } from './board.controller';
import { BoardService } from './board.service';
import { ScyllaModule } from '../scylla/scylla.module';
import { RedisModule } from '../redis/redis.module';
import { WebsocketModule } from 'src/websocket/websocket.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ScyllaModule,
    RedisModule,
    WebsocketModule,
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: require('cache-manager-redis-store'),
        host: configService.get('REDIS_HOST', 'redis'),
        port: configService.get('REDIS_PORT', 6379),
        ttl: 60,
        max: 1000,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [BoardController],
  providers: [BoardService],
  exports: [BoardService],
})
export class BoardModule {}
