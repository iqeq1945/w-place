import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, types, mapping } from 'cassandra-driver';
import {
  BoardSnapshot,
  UserStats,
  PixelHistory,
  PixelUpdate,
} from './interfaces/scylla.interface';

@Injectable()
export class ScyllaService implements OnModuleInit, OnModuleDestroy {
  private client: Client;
  private mapper: mapping.Mapper;
  private pixelHistoryMapper: mapping.ModelMapper<PixelHistory>;
  private boardSnapshotMapper: mapping.ModelMapper<BoardSnapshot>;
  private userStatsMapper: mapping.ModelMapper<UserStats>;
  private readonly boardSize: number;
  // 보드 ID는 고정값으로 설정함.
  private static BOARD_ID: 'c1ca35bb-c7a6-4fba-a926-90dc787df97c';

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
      await this.initializeKeyspaceAndTables();
      this.setupMappers();
    } catch (error) {
      console.error('ScyllaDB 연결 중 오류:', error);
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
        x int,
        y int,
        timestamp timestamp,
        user_id text,
        color_index tinyint,
        PRIMARY KEY ((x, y), timestamp, user_id)
      ) WITH CLUSTERING ORDER BY (
        timestamp DESC, 
        user_id ASC
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
    this.userStatsMapper = this.mapper.forModel('UserStats');
  }

  // Record a pixel placement in the history
  async recordPixelPlacement(
    x: number,
    y: number,
    userId: string,
    colorIndex: number,
  ): Promise<void> {
    await this.pixelHistoryMapper.insert({
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
          'INSERT INTO place.pixel_history (x, y, timestamp, user_id, color_index) VALUES (?, ?, ?, ?, ?)',
        params: [
          update.x,
          update.y,
          new Date(update.timestamp),
          update.userId,
          update.colorIndex,
        ],
      };
    });

    await this.client.batch(queries, { prepare: true });
  }

  // Save a snapshot of the entire board
  async saveBoardSnapshot(board: Buffer): Promise<string> {
    const snapshotId = types.TimeUuid.now();
    await this.boardSnapshotMapper.insert({
      boarId: ScyllaService.BOARD_ID,
      snapshotId: snapshotId,
      timestamp: new Date(),
      board: board,
    });
    return snapshotId.toString();
  }

  // Get the most recent board snapshot
  async getLatestBoardSnapshot(): Promise<Buffer | null> {
    const result = await this.client.execute(
      'SELECT board FROM place.board_snapshots LIMIT 1',
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
  ): Promise<PixelHistory[]> {
    const result = await this.pixelHistoryMapper.find({ x, y }, { limit });
    return result.toArray();
  }

  // Get board snapshots for a time range
  async getBoardSnapshotsInRange(
    startTime: Date,
    endTime: Date,
  ): Promise<BoardSnapshot[]> {
    const query = {
      timestamp: { $gte: startTime, $lte: endTime },
    };
    const result = await this.boardSnapshotMapper.find(query);
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
}
