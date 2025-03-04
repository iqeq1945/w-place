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
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
    });
    this.boardSize = this.configService.get('BOARD_SIZE', 1000);
  }

  // 특정 타일의 색상 값 가져오기
  async getTile(x: number, y: number): Promise<number> {
    const offset = x + y * this.boardSize;
    const result = await this.redisClient.bitfield(
      this.boardKey,
      'GET',
      'u4', // 4-bit unsigned integer
      `#${offset * 4}`, // bit offset
    );
    return result[0] ?? 0; // 결과가 없으면 0 반환
  }

  // 4비트 정수로 색상 저장 (Reddit 방식과 유사)
  async setTile(x: number, y: number, colorIndex: number): Promise<void> {
    const offset = x + y * this.boardSize;
    await this.redisClient.bitfield(
      this.boardKey,
      'SET',
      'u4', // 4-bit unsigned integer
      `#${offset * 4}`, // bit offset
      colorIndex, // color value (0-15)
    );
  }

  // 전체 보드 가져오기
  async getFullBoard(): Promise<Buffer> {
    return this.redisClient.getBuffer(this.boardKey);
  }

  // 사용자의 마지막 타일 배치 시간 관리
  async setLastPlacement(userId: string, timestamp: number): Promise<void> {
    await this.redisClient.set(`place:lastplacement:${userId}`, timestamp);
    // 5분 후 자동 만료 (선택적)
    await this.redisClient.expire(`place:lastplacement:${userId}`, 300);
  }

  async getLastPlacement(userId: string): Promise<number> {
    const result = await this.redisClient.get(`place:lastplacement:${userId}`);
    return result ? parseInt(result, 10) : 0;
  }

  getClient() {
    return this.redisClient;
  }

  getBoardSize() {
    return this.boardSize;
  }
}
