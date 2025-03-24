// websocket.gateway.ts
import {
  WebSocketGateway,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { encode } from '@msgpack/msgpack';

interface PixelUpdate {
  x: number;
  y: number;
  colorIndex: number;
  timestamp: number;
}

@WebSocketGateway({
  cors: {
    origin: [
      'https://wplace.waktaverse.games',
      'http://localhost:3000',
      'http://localhost:5173',
    ],
  },
  perMessageDeflate: true, // 메시지 압축 활성화
  pingInterval: 25000, // ping 간격 설정 (25초)
  pingTimeout: 10000, // ping 타임아웃 설정 (10초)
  transports: ['polling'],
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('WebsocketGateway');
  private userCount: number = 0;
  private pixelUpdateQueue: PixelUpdate[] = [];
  private readonly broadcastInterval = 100;

  constructor() {
    setInterval(() => this.flushPixelUpdates(), this.broadcastInterval);
  }

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.userCount++;
    this.logger.log(
      `Client connected: ${client.id}, Total users: ${this.userCount}`,
    );
    this.server.emit('userCount', this.userCount);
  }

  handleDisconnect(client: Socket) {
    this.userCount--;
    this.logger.log(
      `Client disconnected: ${client.id}, Total users: ${this.userCount}`,
    );
    this.server.emit('userCount', this.userCount);
  }

  // 브로드캐스트 요청 시 큐에 추가
  broadcastTileUpdate(pixelUpdate: PixelUpdate) {
    this.pixelUpdateQueue.push(pixelUpdate);
  }

  // 브로드캐스트 admin 요청
  broadcastAdminUpdate(adminUpdate: PixelUpdate[]) {
    this.pixelUpdateQueue.push(...adminUpdate);
  }

  // 일정 간격마다 모아서 한 번에 전송
  private flushPixelUpdates() {
    if (this.pixelUpdateQueue.length === 0) return;

    const packedData = encode(this.pixelUpdateQueue);
    this.logger.log(`Broadcast Data Length: ${this.pixelUpdateQueue.length}`);
    this.server.emit('pixelUpdate', packedData);

    this.pixelUpdateQueue = []; // 전송 후 큐 초기화
  }

  getUserCount() {
    this.logger.log(`Admin Request User Count: ${this.userCount}`);
    return this.userCount;
  }
}
