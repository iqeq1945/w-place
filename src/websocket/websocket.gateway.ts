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

interface PixelUpdate {
  x: number;
  y: number;
  colorIndex: number;
  timestamp: number;
}

@WebSocketGateway({
  cors: {
    origin: '*', // 실제 프로덕션에서는 정확한 오리진 설정 필요
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('WebsocketGateway');
  private userCount: number = 0;

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.userCount++;
    this.logger.log(
      `Client connected: ${client.id}, Total users: ${this.userCount}`,
    );
  }

  handleDisconnect(client: Socket) {
    this.userCount--;
    this.logger.log(
      `Client disconnected: ${client.id}, Total users: ${this.userCount}`,
    );
  }

  // 타일 업데이트 브로드캐스팅
  broadcastTileUpdate(pixelUpdate: PixelUpdate) {
    this.server.emit('pixelUpdate', pixelUpdate);
  }

  // 현재 사용자 수 제공
  getUserCount(): number {
    return this.userCount;
  }
}
