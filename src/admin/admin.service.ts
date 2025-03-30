import { Logger, Injectable, NotFoundException } from '@nestjs/common';
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
    this.logger.log('Fetching full board');
    return await this.boardService.getFullBoard();
  }

  async getSnapshotIds() {
    this.logger.log('Fetching snapshot IDs');
    return await this.scyllaService.getSnapshotIds();
  }

  async getBoardBySnapshotId(snapshotId: string) {
    this.logger.log(`Fetching board by snapshot ID: ${snapshotId}`);
    return await this.scyllaService.getBoardBySnapshotId(snapshotId);
  }

  async getPixelHistory(
    x: number,
    y: number,
    limit: number = 100,
    userId?: string,
    pageState?: number,
  ) {
    this.logger.log(
      `Fetching pixel history at (${x}, ${y}) with limit ${limit}`,
    );
    return await this.scyllaService.getPixelHistory(
      x,
      y,
      limit,
      userId,
      pageState,
    );
  }

  async getPixelHistoryLength() {
    this.logger.log('Fetching pixel history length');
    return await this.scyllaService.getPixelHistoryLength();
  }

  async getPixelHistoryAll() {
    this.logger.log('Fetching all pixel history');
    return await this.scyllaService.getPixelHistoryAll();
  }

  async getUserCount() {
    this.logger.log('Fetching user count');
    return this.websocketGateway.getUserCount();
  }

  async getBoardSize() {
    this.logger.log('Fetching board size');
    return this.boardSize;
  }

  // 초기 보드 생성 (필요한 경우)
  async initializeBoard(): Promise<void> {
    const exists = await this.redisService.getClient().exists('place:board');
    if (!exists) {
      const totalSize = this.boardSize * this.boardSize;
      const initialBoard = Buffer.alloc(Math.ceil(totalSize));
      await this.redisService.getClient().set('place:board', initialBoard);
      await this.scyllaService.saveBoardSnapshot(initialBoard);
      this.logger.log('Board initialized'); // 보드 초기화 로그
    } else {
      this.logger.warn('Board already exists, initialization skipped');
    }
  }

  // 보드 상태로 초기로 복구합니다.
  async resetBoard(): Promise<void> {
    const totalSize = this.boardSize * this.boardSize;
    const initialBoard = Buffer.alloc(Math.ceil(totalSize));
    await this.redisService.getClient().set('place:board', initialBoard);
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
    await this.scyllaService.saveBoardSnapshot(randomBoard);
    this.logger.log('Board Scylla Random'); // 보드 초기화 로그
  }

  async clearCache() {
    this.logger.log('Clearing cache');
    await this.boardService.clearCache();
  }

  async getSnapshotCount(): Promise<number> {
    this.logger.log('Fetching snapshot count');
    return await this.scyllaService.getSnapshotCount();
  }

  async setCooldownPeriod(cooldownPeriod: number): Promise<void> {
    this.logger.log(`Setting cooldown period to ${cooldownPeriod}`);
    await this.boardService.setCooldownPeriod(cooldownPeriod);
  }

  async setBan(userId: string) {
    this.logger.log(`Setting ban for user: ${userId}`);
    return await this.redisService.setBanUser(userId);
  }

  async getBanUserAll() {
    this.logger.log('Fetching all banned users');
    return await this.redisService.getBanUserAll();
  }

  async deleteBanUser(userId: string) {
    this.logger.log(`Deleting ban for user: ${userId}`);
    return await this.redisService.deleteBanUser(userId);
  }

  async setTileArea(
    startX: number,
    startY: number,
    width: number,
    height: number,
  ) {
    this.logger.log(
      `Setting tile area from (${startX}, ${startY}) with size ${width}x${height}`,
    );
    const result = await this.redisService.setTileArea(
      startX,
      startY,
      width,
      height,
    );

    if (result) {
      const adminUpdate = [];
      for (let y = startY; y < startY + height; y++) {
        for (let x = startX; x < startX + width; x++) {
          adminUpdate.push({ x, y, colorIndex: 33 });
        }
      }
      this.websocketGateway.broadcastAdminUpdate(adminUpdate);
      this.logger.log(`Tile area set successfully from (${startX}, ${startY})`); // 성공 로그 추가
    } else {
      this.logger.warn(`Failed to set tile area from (${startX}, ${startY})`); // 실패 로그 추가
    }
    return result;
  }

  async rollbackBoard(id: string): Promise<void> {
    this.logger.log(`Rolling back board to snapshot ID: ${id}`);
    await this.boardService.rollbackBoard(id);
    this.logger.log(`Board rollback to snapshot ID: ${id}`);
  }
}
