export class BoardMother {
  static create(boardSize: number): Buffer<ArrayBuffer> {
    const totalSize = boardSize * boardSize;
    const randomBoard = Buffer.alloc(Math.ceil(totalSize));

    for (let i = 0; i < totalSize; i++) {
      randomBoard[i] = Math.floor(Math.random() * 32);
    }
    return randomBoard;
  }

  static createEmpty() {
    return Buffer.alloc(0);
  }
}
