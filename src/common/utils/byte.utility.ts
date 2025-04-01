export class ByteUtility {
  static removeEmptyBytes(buffer: Buffer): Buffer {
    return Buffer.from(buffer.toString('utf8').replace(/\0/g, ''));
  }
}
