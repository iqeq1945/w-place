import { Module } from '@nestjs/common';
import { BoardModule } from './board/board.module';
import { WakgamesModule } from './wakgames/wakgames.module';
import { WebsocketModule } from './websocket/websocket.module';
import { RedisModule } from './redis/redis.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScyllaModule } from './scylla/scylla.module';
import { AppController } from './app.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { AdminModule } from './admin/admin.module';
import { CacheModule } from '@nestjs/cache-manager';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        host: configService.get('REDIS_HOST', 'redis'),
        port: configService.get('REDIS_PORT', 6379),
      }),
      inject: [ConfigService],
    }),
    RedisModule,
    BoardModule,
    WakgamesModule,
    WebsocketModule,
    ScyllaModule,
    ScheduleModule.forRoot(),
    AuthModule,
    AdminModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
