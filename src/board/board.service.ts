// board.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { ScyllaService } from '../scylla/scylla.service';
import { PixelHistory } from 'src/scylla/interfaces/scylla.interface';

@Injectable()
export class BoardService {
  private readonly cooldownPeriod: number; // 밀리초 단위
  private readonly boardSize: number;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    private websocketGateway: WebsocketGateway,
    private scyllaService: ScyllaService,
  ) {
    this.cooldownPeriod = this.configService.get(
      'COOLDOWN_PERIOD',
      5 * 60 * 1000,
    ); // 5분
    this.boardSize = this.configService.get('BOARD_SIZE', 1000);
  }

  async getFullBoard(): Promise<Buffer> {
    return this.redisService.getFullBoard();
  }

  async getTileDetails(x: number, y: number): Promise<PixelHistory | null> {
    const history = await this.scyllaService.getPixelHistory(x, y, 1);
    return history[0] || null;
  }

  async placeTile(
    x: number,
    y: number,
    colorIndex: number,
    userId: string,
  ): Promise<void> {
    // 입력값 검증
    if (x < 0 || x >= this.boardSize || y < 0 || y >= this.boardSize) {
      throw new BadRequestException('Invalid coordinates');
    }

    if (colorIndex < 0 || colorIndex > 15) {
      throw new BadRequestException('Invalid color index');
    }

    // 쿨다운 체크
    const lastPlacement = await this.redisService.getLastPlacement(userId);
    const now = Date.now();

    if (lastPlacement > 0 && now - lastPlacement < this.cooldownPeriod) {
      const remainingTime = Math.ceil(
        (this.cooldownPeriod - (now - lastPlacement)) / 1000,
      );
      throw new BadRequestException(
        `You can place a tile in ${remainingTime} seconds`,
      );
    }

    // Redis 트랜잭션으로 race condition 방지
    const multi = this.redisService.getClient().multi();

    // 1. 쿨다운 체크 및 업데이트
    multi.set(`place:lastplacement:${userId}`, now);
    multi.expire(`place:lastplacement:${userId}`, 300); // 5분 후 만료

    // 2. 보드 업데이트
    const offset = x + y * this.boardSize;
    multi.bitfield('place:board', 'SET', 'u4', `#${offset * 4}`, colorIndex);

    // 트랜잭션 실행
    await multi.exec();

    // ScyllaDB에 픽셀 히스토리 기록
    await this.scyllaService.recordPixelPlacement(x, y, userId, colorIndex);

    // WebSocket을 통해 모든 클라이언트에 업데이트 알림
    this.websocketGateway.broadcastTileUpdate({
      x,
      y,
      colorIndex,
      timestamp: now,
    });
  }

  // 초기 보드 생성 (필요한 경우)
  async initializeBoard(): Promise<void> {
    const exists = await this.redisService.getClient().exists('place:board');
    if (!exists) {
      // 초기 보드는 모두 하얀색(0)으로 설정
      const totalSize = this.boardSize * this.boardSize;
      const initialBoard = Buffer.alloc(Math.ceil(totalSize / 2));
      await this.redisService.getClient().set('place:board', initialBoard);

      // 초기 보드 스냅샷 저장
      await this.scyllaService.saveBoardSnapshot(initialBoard);

      console.log('Board initialized');
    }
  }
}
