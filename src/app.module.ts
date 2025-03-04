import { Module } from '@nestjs/common';
import { BoardModule } from './board/board.module';
import { WebsocketModule } from './websocket/websocket.module';
import { RedisModule } from './redis/redis.module';
import { ConfigModule } from '@nestjs/config';
import { ScyllaModule } from './scylla/scylla.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisModule,
    BoardModule,
    WebsocketModule,
    ScyllaModule,
  ],
})
export class AppModule {}
