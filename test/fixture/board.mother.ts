import * as process from 'node:process';
import { BoardSnapshot } from '../../src/scylla/interfaces/scylla.interface';
import { types } from 'cassandra-driver';

export class BoardMother {
  static createRandom(
    boardSize = parseInt(process.env.BOARD_SIZE) || 610,
  ): Buffer<ArrayBuffer> {
    const totalSize = boardSize * boardSize;
    const randomBoard = Buffer.alloc(Math.ceil(totalSize));

    for (let i = 0; i < totalSize; i++) {
      randomBoard[i] = Math.floor(Math.random() * 32);
    }
    return randomBoard;
  }

  static createSnapshot(): BoardSnapshot {
    return {
      boardId: types.Uuid.random(),
      snapshotId: types.TimeUuid.now(),
      timestamp: new Date(),
      board: this.createRandom(),
    };
  }

  static createEmpty() {
    return Buffer.alloc(0);
  }
}
