import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, types, mapping } from 'cassandra-driver';
import {
  BoardSnapshot,
  PixelHistory,
  PixelUpdate,
} from './interfaces/scylla.interface';

@Injectable()
export class ScyllaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScyllaService.name);
  private client: Client;
  private mapper: mapping.Mapper;
  private pixelHistoryMapper: mapping.ModelMapper<PixelHistory>;
  private boardSnapshotMapper: mapping.ModelMapper<BoardSnapshot>;
  private readonly boardSize: number;
  // 보드 ID는 고정값으로 설정함.
  private static BOARD_ID = 'c1ca35bb-c7a6-4fba-a926-90dc787df97c';

  constructor(private configService: ConfigService) {
    const contactPoints = this.configService
      .get<string>('SCYLLA_CONTACT_POINTS', 'scylla')
      .split(',');
    const datacenter = this.configService.get<string>(
      'SCYLLA_DATACENTER',
      'datacenter1',
    );

    this.client = new Client({
      contactPoints,
      localDataCenter: datacenter,
      protocolOptions: {
        maxVersion: 4,
      },
      pooling: {
        coreConnectionsPerHost: {
          [types.distance.local]: 2,
          [types.distance.remote]: 1,
        },
      },
    });

    this.boardSize = this.configService.get('BOARD_SIZE', 610);
  }

  async onModuleInit() {
    try {
      await this.client.connect();
      this.logger.log('ScyllaDB에 연결되었습니다.');
      await this.initializeKeyspaceAndTables();
      this.setupMappers();
    } catch (error) {
      this.logger.error('ScyllaDB 연결 중 오류:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.client.shutdown();
  }

  private async initializeKeyspaceAndTables() {
    const keyspace = this.configService.get<string>('SCYLLA_KEYSPACE', 'place');
    const datacenter = this.configService.get<string>(
      'SCYLLA_DATACENTER',
      'datacenter1',
    );

    // Create keyspace if not exists
    await this.client.execute(`
      CREATE KEYSPACE IF NOT EXISTS ${keyspace}
      WITH replication = {
          'class': 'NetworkTopologyStrategy', 
          '${datacenter}': 1
      }
      AND durable_writes = true;
    `);

    // Use the keyspace
    await this.client.execute(`USE ${keyspace};`);

    // Create tables
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${keyspace}.pixel_history (
        history_id timeuuid,
        x int,
        y int,
        timestamp timestamp,
        user_id text,
        color_index tinyint,
        PRIMARY KEY ((x, y), user_id, history_id)
      ) WITH CLUSTERING ORDER BY (
       user_id ASC,
        history_id DESC
      )
      AND compaction = {
        'class': 'TimeWindowCompactionStrategy', 
        'compaction_window_unit': 'DAYS', 
        'compaction_window_size': 7
      }
      AND gc_grace_seconds = 86400;
    `);

    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${keyspace}.board_snapshots (
        board_id    uuid,
        snapshot_id timeuuid,
        timestamp timestamp,
        board blob,
        PRIMARY KEY (board_id, snapshot_id)
      ) WITH CLUSTERING ORDER BY (snapshot_id ASC)
      AND compaction = {
        'class': 'TimeWindowCompactionStrategy', 
        'compaction_window_unit': 'DAYS', 
        'compaction_window_size': 7
      };
    `);
  }

  private setupMappers() {
    this.mapper = new mapping.Mapper(this.client, {
      models: {
        PixelHistory: {
          tables: ['pixel_history'],
          mappings: new mapping.UnderscoreCqlToCamelCaseMappings(),
        },
        BoardSnapshot: {
          tables: ['board_snapshots'],
          mappings: new mapping.UnderscoreCqlToCamelCaseMappings(),
        },
      },
    });

    this.pixelHistoryMapper = this.mapper.forModel('PixelHistory');
    this.boardSnapshotMapper = this.mapper.forModel('BoardSnapshot');
  }

  // Record a pixel placement in the history
  async recordPixelPlacement(
    x: number,
    y: number,
    userId: string,
    colorIndex: number,
  ): Promise<void> {
    await this.pixelHistoryMapper.insert({
      historyId: types.TimeUuid.now(),
      x,
      y,
      timestamp: new Date(),
      userId,
      colorIndex,
    });
  }

  // Batch insert multiple pixel updates (for efficiency)
  async batchInsertPixelHistory(updates: PixelUpdate[]): Promise<void> {
    const queries = updates.map((update) => {
      return {
        query:
          'INSERT INTO place.pixel_history (history_id, x, y, timestamp, user_id, color_index) VALUES (?, ?, ?, ?, ?, ?)',
        params: [
          types.TimeUuid.now(),
          update.x,
          update.y,
          new Date(update.timestamp),
          update.userId,
          update.colorIndex,
        ],
      };
    });

    await this.client.batch(queries, { prepare: true });
    this.logger.log(`픽셀 기록 ${updates.length}개가 배치로 삽입되었습니다.`);
  }

  // Save a snapshot of the entire board
  async saveBoardSnapshot(board: Buffer): Promise<string> {
    const snapshotId = types.TimeUuid.now();
    await this.boardSnapshotMapper.insert({
      boardId: ScyllaService.BOARD_ID,
      snapshotId: snapshotId,
      timestamp: new Date(),
      board: board,
    });
    this.logger.log(`보드 스냅샷이 저장되었습니다. 스냅샷 ID: ${snapshotId}`);
    return snapshotId.toString();
  }

  // Get the most recent board snapshot
  async getLatestBoardSnapshot(): Promise<Buffer | null> {
    const result = await this.client.execute(
      'SELECT board FROM place.board_snapshots WHERE board_id = ? LIMIT 1',
      [ScyllaService.BOARD_ID],
    );

    if (result.rowLength === 0) {
      return null;
    }

    return result.first().get('board');
  }

  // Get pixel history for a specific position
  async getPixelHistory(
    x: number,
    y: number,
    limit: number = 10,
    userId?: string,
    pageState?: number,
  ): Promise<PixelHistory[]> {
    const result = await this.pixelHistoryMapper.find(
      userId ? { x, y, userId } : { x, y },
      { limit },
      { pageState },
    );

    return result.toArray();
  }

  async getPixelHistoryAll(limit: number = 10): Promise<PixelHistory[]> {
    const result = await this.pixelHistoryMapper.findAll({ limit });
    return result.toArray();
  }

  async executeQuery(query: string): Promise<Array<unknown>> {
    const result = await this.client.execute(query);

    if (result.rowLength === 0) {
      return [];
    }

    return result.rows;
  }

  // Get the client for custom queries
  getClient(): Client {
    return this.client;
  }

  async getSnapshotIds(): Promise<
    {
      snapshotId: string;
      timestamp: string;
    }[]
  > {
    const result = await this.boardSnapshotMapper.findAll({
      fields: ['snapshot_id', 'timestamp'],
    });
    return result.toArray().map((snapshot) => ({
      snapshotId: snapshot.snapshotId.toString(),
      timestamp: snapshot.timestamp.toISOString(),
    }));
  }

  async getBoardBySnapshotId(snapshotId: string): Promise<Buffer | null> {
    const result = await this.boardSnapshotMapper.find({
      boardId: ScyllaService.BOARD_ID,
      snapshotId,
    });
    return result.toArray()[0].board;
  }

  async getPixelHistoryLength(): Promise<number> {
    try {
      const result = await this.client.execute(
        'SELECT COUNT(*) FROM place.pixel_history',
      );

      // 결과가 존재하는지 확인
      if (result.rowLength === 0) {
        this.logger.warn('픽셀 기록이 없습니다.');
        return 0; // 결과가 없을 경우 0 반환
      }

      this.logger.log(`픽셀 기록 개수: ${result.first().get('count')}`);
      return result.first().get('count');
    } catch (error) {
      this.logger.error('픽셀 기록 개수 조회 중 오류:', error);
      throw error; // 오류를 다시 던져서 호출자에게 알림
    }
  }

  async getPixelHistoryByUserId(userId: string): Promise<PixelHistory[]> {
    const result = await this.pixelHistoryMapper.find({
      fields: ['x', 'y', 'timestamp', 'color_index', 'history_id', 'user_id'],
      where: { user_id: userId },
    });
    return result.toArray();
  }
}
