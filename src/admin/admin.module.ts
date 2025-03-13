import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from 'src/redis/redis.module';
import { ScyllaModule } from 'src/scylla/scylla.module';
import { WebsocketModule } from 'src/websocket/websocket.module';
import { AdminService } from './admin.service';

@Module({
  imports: [
    ScyllaModule,
    RedisModule,
    WebsocketModule,
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: require('cache-manager-redis-store'),
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
        ttl: 60,
        max: 1000,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AdminService],
})
export class AdminModule {}
