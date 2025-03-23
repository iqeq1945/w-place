import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BoardService } from 'src/board/board.service';
import { RedisService } from 'src/redis/redis.service';
import { ScyllaService } from 'src/scylla/scylla.service';
import { WebsocketGateway } from 'src/websocket/websocket.gateway';

@Injectable()
export class AdminService {
  private readonly boardSize: number;
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly websocketGateway: WebsocketGateway,
    private readonly scyllaService: ScyllaService,
    private readonly boardService: BoardService,
  ) {
    this.boardSize = this.configService.get('BOARD_SIZE', 610);
  }

  async getBoard() {
    return await this.boardService.getFullBoard();
  }

  async getSnapshotIds() {
    return await this.scyllaService.getSnapshotIds();
  }

  async getBoardBySnapshotId(snapshotId: string) {
    return await this.scyllaService.getBoardBySnapshotId(snapshotId);
  }

  async getPixelHistory(
    x: number,
    y: number,
    limit: number = 10,
    userId?: string,
    pageState?: number,
  ) {
    return await this.scyllaService.getPixelHistory(
      x,
      y,
      limit,
      userId,
      pageState,
    );
  }

  async getPixelHistoryLength() {
    return await this.scyllaService.getPixelHistoryLength();
  }

  async getPixelHistoryAll() {
    return await this.scyllaService.getPixelHistoryAll();
  }

  async getUserCount() {
    return this.websocketGateway.getUserCount();
  }

  async getBoardSize() {
    return this.boardSize;
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

  // 보드 상태로 초기로 복구합니다.
  async resetBoard(): Promise<void> {
    // 초기 보드는 모두 하얀색(0)으로 설정
    const totalSize = this.boardSize * this.boardSize;
    const initialBoard = Buffer.alloc(Math.ceil(totalSize));
    await this.redisService.getClient().set('place:board', initialBoard);
    // 초기 보드 스냅샷 저장
    await this.scyllaService.saveBoardSnapshot(initialBoard);
    this.logger.log('Board reset'); // 보드 초기화 로그
  }

  // 랜덤 보드 생성 (필요한 경우)
  async randomBoard(): Promise<void> {
    const totalSize = this.boardSize * this.boardSize;
    const randomBoard = Buffer.alloc(Math.ceil(totalSize));

    for (let i = 0; i < totalSize; i++) {
      randomBoard[i] = Math.floor(Math.random() * 32);
    }

    await this.redisService.getClient().set('place:board', randomBoard);
    this.logger.log('Board Redis Random'); // 보드 초기화 로그
    // 초기 보드 스냅샷 저장
    await this.scyllaService.saveBoardSnapshot(randomBoard);
    this.logger.log('Board Scylla Random'); // 보드 초기화 로그
  }

  async clearCache() {
    await this.boardService.clearCache();
  }

  async getSnapshotCount(): Promise<number> {
    return await this.scyllaService.getSnapshotCount();
  }
}
