import { Module } from '@nestjs/common';
import { RedisModule } from 'src/redis/redis.module';
import { ScyllaModule } from 'src/scylla/scylla.module';
import { WebsocketModule } from 'src/websocket/websocket.module';
import { AdminService } from './admin.service';
import { BoardModule } from 'src/board/board.module';
import { AdminController } from './admin.controller';
import { AdminRepository } from './admin.repository';

@Module({
  imports: [BoardModule, ScyllaModule, RedisModule, WebsocketModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
})
export class AdminModule {}
