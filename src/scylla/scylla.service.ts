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

  constructor(private configService: ConfigService) {
    const contactPoints = this.configService
      .get<string>('SCYLLA_CONTACT_POINTS', 'localhost')
      .split(',');
    const datacenter = this.configService.get<string>(
      'SCYLLA_DATACENTER',
      'datacenter1',
    );
    const keyspace = this.configService.get<string>('SCYLLA_KEYSPACE', 'place');

    this.client = new Client({
      contactPoints,
      localDataCenter: datacenter,
      keyspace,
      protocolOptions: {
        maxVersion: 4, // Use protocol version compatible with ScyllaDB
      },
      pooling: {
        coreConnectionsPerHost: {
          [types.distance.local]: 2,
          [types.distance.remote]: 1,
        },
      },
    });

    this.boardSize = this.configService.get('BOARD_SIZE', 1000);
  }

  async onModuleInit() {
    await this.client.connect();
    await this.setupSchema();
    this.setupMappers();
  }

  async onModuleDestroy() {
    await this.client.shutdown();
  }

  private async setupSchema() {
    // Create keyspace if not exists
    await this.client.execute(`
      CREATE KEYSPACE IF NOT EXISTS place
      WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 3}
      AND durable_writes = true;
    `);

    // Create tables if not exist
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS place.pixel_history (
        x int,
        y int,
        timestamp timestamp,
        user_id text,
        color_index tinyint,
        PRIMARY KEY ((x, y), timestamp)
      ) WITH CLUSTERING ORDER BY (timestamp DESC)
      AND compaction = {'class': 'TimeWindowCompactionStrategy', 
                      'compaction_window_unit': 'DAYS', 
                      'compaction_window_size': 7}
      AND gc_grace_seconds = 86400;
    `);

    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS place.board_snapshots (
        snapshot_id uuid,
        timestamp timestamp,
        board blob,
        PRIMARY KEY (snapshot_id)
      );
    `);

    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS place.user_stats (
        user_id int,
        pixels_placed counter,
        PRIMARY KEY (user_id)
      );
    `);

    // Create indexes
    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS ON place.board_snapshots (timestamp);
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
        UserStats: {
          tables: ['user_stats'],
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

    // Increment user stats counter
    await this.client.execute(
      'UPDATE place.user_stats SET pixels_placed = pixels_placed + 1 WHERE user_id = ?',
      [userId],
      { prepare: true },
    );
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

    // 타입을 명시적으로 정의
    const userUpdates: { [key: string]: number } = {};

    updates.forEach((update) => {
      if (!userUpdates[update.userId]) {
        userUpdates[update.userId] = 0;
      }
      userUpdates[update.userId]++;
    });

    Object.entries(userUpdates).forEach(([userId, count]) => {
      queries.push({
        query:
          'UPDATE place.user_stats SET pixels_placed = pixels_placed + ? WHERE user_id = ?',
        params: [count, userId],
      });
    });

    await this.client.batch(queries, { prepare: true });
  }

  // Save a snapshot of the entire board
  async saveBoardSnapshot(board: Buffer): Promise<string> {
    const snapshotId = types.Uuid.random();
    await this.boardSnapshotMapper.insert({
      snapshotId: snapshotId,
      timestamp: new Date(),
      board: board,
    });
    return snapshotId.toString();
  }

  // Get the most recent board snapshot
  async getLatestBoardSnapshot(): Promise<Buffer | null> {
    const result = await this.client.execute(
      'SELECT board FROM place.board_snapshots ORDER BY timestamp DESC LIMIT 1',
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

  // Get user statistics
  async getUserStats(userId: string): Promise<UserStats | null> {
    const result = await this.userStatsMapper.get({ userId });
    return result;
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

  // Get the client for custom queries
  getClient(): Client {
    return this.client;
  }
}
