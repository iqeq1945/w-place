import { Module } from '@nestjs/common';
import { BoardController } from './board.controller';
import { BoardService } from './board.service';
import { ScyllaModule } from '../scylla/scylla.module';
import { RedisModule } from '../redis/redis.module';
import { WebsocketModule } from 'src/websocket/websocket.module';

@Module({
  imports: [
    ScyllaModule, // ScyllaDB 연결을 위해
    RedisModule, // Redis 연결을 위해
    WebsocketModule,
  ],
  controllers: [BoardController],
  providers: [BoardService],
  exports: [BoardService], // 다른 모듈에서 BoardService를 사용할 수 있도록
})
export class BoardModule {}
