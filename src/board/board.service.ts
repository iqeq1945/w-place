// board.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisService } from '../redis/redis.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { Tile } from './schemas/tile.schema';

@Injectable()
export class BoardService {
  private readonly cooldownPeriod: number; // 밀리초 단위
  private readonly boardSize: number;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    private websocketGateway: WebsocketGateway,
    @InjectModel(Tile.name) private tileModel: Model<Tile>,
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

  async getTileDetails(x: number, y: number): Promise<Tile> {
    return this.tileModel.findOne({ x, y }).sort({ timestamp: -1 }).exec();
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

    // 쿨다운 체크 - 동시 요청 Race Condition 방지를 위한 Redis Transaction 사용
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

    // Redis에서 타일 배치 처리
    // MULTI를 통한 트랜잭션으로 race condition 방지
    const multi = this.redisService.getClient().multi();

    // 1. 쿨다운 체크 및 업데이트
    multi.set(`place:lastplacement:${userId}`, now);

    // 2. 보드 업데이트
    const offset = x + y * this.boardSize;
    multi.bitfield('place:board', 'SET', 'u4', `#${offset * 4}`, colorIndex);

    await multi.exec();

    // MongoDB에 세부 정보 저장
    const newTile = new this.tileModel({
      x,
      y,
      colorIndex,
      userId,
      timestamp: now,
    });
    await newTile.save();

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
      const initialBoard = Buffer.alloc(Math.ceil(totalSize / 2)); // 4비트 색상이므로 2개의 색상이 1바이트에 저장됨
      await this.redisService.getClient().set('place:board', initialBoard);
      console.log('Board initialized');
    }
  }
}
