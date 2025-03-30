import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly redisClient: Redis;
  private readonly boardKey = 'place:board';
  private readonly boardSize: number;

  constructor(private configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get('REDIS_HOST', 'redis'),
      port: this.configService.get('REDIS_PORT', 6379),
    });
    this.boardSize = this.configService.get('BOARD_SIZE', 610);
  }

  // 특정 타일의 색상 값 가져오기
  async getTile(x: number, y: number): Promise<number> {
    const offset = x + y * this.boardSize;
    const result = await this.redisClient.bitfield(
      this.boardKey,
      'GET',
      'u8', // 8-bit unsigned integer
      `#${offset}`, // bit offset
    );
    return result[0] ?? -1; // 결과가 없으면 -1 반환
  }

  // 8비트 정수로 색상 저장 (0-255 범위)
  async setTile(x: number, y: number, colorIndex: number): Promise<void> {
    const offset = x + y * this.boardSize;
    await this.redisClient.bitfield(
      this.boardKey,
      'SET',
      'u8', // 8-bit unsigned integer
      `#${offset}`, // bit offset
      colorIndex, // color value (0-255)
    );
  }

  // 전체 보드 가져오기
  async getFullBoard(): Promise<Buffer> {
    const board = await this.redisClient.getBuffer(this.boardKey);
    return board;
  }

  async setBoard(board: Buffer): Promise<void> {
    await this.redisClient.set(this.boardKey, board);
  }

  // 사용자의 마지막 타일 배치 시간 관리
  async setLastPlacement(
    userId: string,
    timestamp: number,
    cooldown: number,
  ): Promise<void> {
    await this.redisClient.set(`place:lastplacement:${userId}`, timestamp);
    await this.redisClient.expire(`place:lastplacement:${userId}`, cooldown);
  }

  // 사용자의 마지막 타일 배치 시간 가져오기
  async getLastPlacement(userId: string): Promise<number> {
    const result = await this.redisClient.get(`place:lastplacement:${userId}`);
    return result ? parseInt(result, 10) : 0;
  }

  // Redis 클라이언트 반환
  getClient() {
    return this.redisClient;
  }

  // 보드 크기 반환
  getBoardSize() {
    return this.boardSize;
  }

  // 사용자 차단 설정
  async setBanUser(userId: string): Promise<string> {
    return await this.redisClient.set(`ban:${userId}`, 'true');
  }

  // 사용자 차단 여부 확인
  async getBanUser(userId: string): Promise<boolean> {
    const result = await this.redisClient.get(`ban:${userId}`);
    return result === 'true';
  }

  // 모든 차단된 사용자 목록 가져오기
  async getBanUserAll(): Promise<string[]> {
    return await this.redisClient
      .keys('ban:*')
      .then((keys) => keys.map((key) => key.replace('ban:', '')));
  }

  async deleteBanUser(userId: string): Promise<boolean> {
    return (await this.redisClient.del(`ban:${userId}`)) === 1;
  }

  // 특정 영역의 타일들을 한 번에 수정
  async setTileArea(
    startX: number,
    startY: number,
    width: number,
    height: number,
  ): Promise<boolean> {
    const pipeline = this.redisClient.pipeline();

    for (let y = startY; y < startY + height; y++) {
      for (let x = startX; x < startX + width; x++) {
        if (x >= 0 && x < this.boardSize && y >= 0 && y < this.boardSize) {
          const offset = x + y * this.boardSize;
          pipeline.bitfield(this.boardKey, 'SET', 'u8', `#${offset}`, 0);
        }
      }
    }

    const results = await pipeline.exec();

    return results.every(([err]) => !err);
  }
}
