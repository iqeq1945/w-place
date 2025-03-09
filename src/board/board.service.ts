// board.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { ScyllaService } from '../scylla/scylla.service';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cron } from '@nestjs/schedule'; // Cron 데코레이터 추가

@Injectable()
export class BoardService {
  private readonly cooldownPeriod: number; // 밀리초 단위
  private readonly boardSize: number;
  private readonly logger = new Logger(BoardService.name);

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly redisService: RedisService,
    private readonly websocketGateway: WebsocketGateway,
    private readonly scyllaService: ScyllaService,
  ) {
    this.cooldownPeriod = this.configService.get(
      'COOLDOWN_PERIOD',
      158 * 1000, // 158초
    );
    this.boardSize = this.configService.get('BOARD_SIZE', 610);
  }

  async getFullBoard(): Promise<Buffer> {
    // 캐시에서 보드 데이터 확인
    const cachedBoard = await this.cacheManager.get<Buffer>('board');
    if (cachedBoard) {
      this.logger.log(`cache : ${cachedBoard.length}byte`);
      return cachedBoard;
    }

    // Redis에서 보드 데이터 가져오기
    const board = await this.redisService.getFullBoard();
    if (board) {
      // 캐시에 저장
      this.logger.log(`redis : ${board.length}byte`);
      await this.cacheManager.set('board', board, 60 * 1000); // 1분 캐시
      return board;
    }

    // ScyllaDB에서 가져오기
    const scyllaBoard = await this.scyllaService.getLatestBoardSnapshot();
    if (scyllaBoard) {
      // Redis와 캐시에 저장
      this.logger.log(`scylla : ${scyllaBoard.length}byte`);

      await this.redisService.getClient().set('place:board', scyllaBoard);
      await this.cacheManager.set('board', scyllaBoard, 60 * 1000);
      return scyllaBoard;
    }

    return Buffer.alloc(0); // 빈 보드 반환
  }

  async getTileDetails(x: number, y: number) {
    const cacheKey = `${x}:${y}`;

    // 캐시에서 타일 정보 확인
    const cachedTile = await this.cacheManager.get(cacheKey);
    if (cachedTile) {
      this.logger.log(`Cache hit for tile at (${x}, ${y})`); // 캐시 히트 로그
      return cachedTile;
    }

    // Redis에서 픽셀 색상 확인
    const colorIndex = await this.redisService.getTile(x, y);
    this.logger.log(
      `Fetched tile color from Redis for (${x}, ${y}): ${colorIndex}`,
    ); // Redis에서 색상 조회 로그

    const tileInfo = {
      x,
      y,
      colorIndex,
      timestamp: new Date(),
    };
    await this.cacheManager.set(cacheKey, tileInfo, 5 * 60 * 1000); // 5분 캐시
    this.logger.log(`Tile info cached for (${x}, ${y})`); // 캐시 저장 로그
    return tileInfo;
  }

  async placeTile(x: number, y: number, colorIndex: number, userId: string) {
    try {
      // 마지막 배치 시간 확인
      const lastPlacement = await this.redisService.getLastPlacement(userId);
      const now = Date.now();
      if (now - lastPlacement < this.cooldownPeriod) {
        this.logger.warn(
          `User ${userId} attempted to place tile too soon at (${x}, ${y})`,
        ); // 경고 로그
        throw new Error('Please wait before placing another tile');
      }

      // ScyllaDB에 기록
      await this.scyllaService.recordPixelPlacement(x, y, userId, colorIndex);
      this.logger.log(
        `Recorded pixel placement for user ${userId} at (${x}, ${y}) with color ${colorIndex}`,
      ); // 배치 기록 로그

      // Redis 업데이트
      await this.redisService.setTile(x, y, colorIndex);
      await this.redisService.setLastPlacement(userId, now);

      // 캐시 무효화
      await this.cacheManager.del('board');
      await this.cacheManager.del(`${x}:${y}`);
      this.logger.log(`Cache invalidated for board and tile at (${x}, ${y})`); // 캐시 무효화 로그

      // WebSocket을 통해 다른 클라이언트에게 업데이트 알림
      this.websocketGateway.broadcastTileUpdate({
        x,
        y,
        colorIndex,
        timestamp: now,
      });
      this.logger.log(`Broadcasted tile update for (${x}, ${y})`); // WebSocket 업데이트 로그

      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error placing tile at (${x}, ${y}): ${error.message}`); // 오류 로그
      throw error;
    }
  }

  // 초기 보드 생성 (필요한 경우)
  async initializeBoard(): Promise<void> {
    const exists = await this.redisService.getClient().exists('place:board');
    if (!exists) {
      // 초기 보드는 모두 하얀색(0)으로 설정
      const totalSize = this.boardSize * this.boardSize;
      const initialBoard = Buffer.alloc(Math.ceil(totalSize));
      await this.redisService.getClient().set('place:board', initialBoard);
      // 초기 보드 스냅샷 저장
      await this.scyllaService.saveBoardSnapshot(initialBoard);
      this.logger.log('Board initialized'); // 보드 초기화 로그
    }
  }

  // 캐시 초기화 (관리자용)
  async clearCache() {
    await this.cacheManager.clear();
    this.logger.log('Board Cache Clear'); // 캐시 초기화 로그
  }

  async test() {
    // Redis에서 보드 데이터 가져오기
    const board = await this.redisService.getFullBoard();
    // ScyllaDB에서 가져오기
    const scyllaBoard = await this.scyllaService.getLatestBoardSnapshot();

    console.log(board, scyllaBoard);
    console.log(scyllaBoard.length, scyllaBoard.byteLength);
  }

  // 주기적으로 Redis의 place:board 값을 ScyllaDB에 저장하는 메서드
  @Cron('*/1 * * * *') // 1분마다 실행
  private async syncBoardToScylla() {
    try {
      this.logger.log('Start Syncing to ScyllaDB'); // 동기화 로그

      const board = await this.redisService
        .getClient()
        .getBuffer('place:board');
      if (board) {
        await this.scyllaService.saveBoardSnapshot(board);
        this.logger.log('Board synced to ScyllaDB'); // 동기화 로그
      }
    } catch (error) {
      this.logger.error(`Error syncing board to ScyllaDB: ${error.message}`); // 오류 로그
    }
  }
}
