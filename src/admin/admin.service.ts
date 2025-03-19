import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/redis/redis.service';
import { ScyllaService } from 'src/scylla/scylla.service';
import { WebsocketGateway } from 'src/websocket/websocket.gateway';

@Injectable()
export class AdminService {
  private readonly boardSize: number;
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly redisService: RedisService,
    private readonly websocketGateway: WebsocketGateway,
    private readonly scyllaService: ScyllaService,
  ) {
    this.boardSize = this.configService.get('BOARD_SIZE', 610);
  }
}
