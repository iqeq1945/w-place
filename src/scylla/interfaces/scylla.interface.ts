import { types } from 'cassandra-driver';

export interface PixelUpdate {
  x: number;
  y: number;
  timestamp: number;
  userId: string;
  colorIndex: number;
}

export interface PixelHistory {
  x: number;
  y: number;
  timestamp: Date;
  userId: string;
  colorIndex: number;
}

export interface BoardSnapshot {
  boardId: types.Uuid;
  snapshotId: types.TimeUuid;
  timestamp: Date;
  board: Buffer;
}

export interface UserStats {
  userId: string;
  pixelsPlaced: number;
}
