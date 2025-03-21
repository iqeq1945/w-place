import { Module } from '@nestjs/common';
import { BoardController } from './board.controller';
import { BoardService } from './board.service';
import { ScyllaModule } from '../scylla/scylla.module';
import { RedisModule } from '../redis/redis.module';
import { WebsocketModule } from 'src/websocket/websocket.module';

@Module({
  imports: [ScyllaModule, RedisModule, WebsocketModule],
  controllers: [BoardController],
  providers: [BoardService],
  exports: [BoardService],
})
export class BoardModule {}
