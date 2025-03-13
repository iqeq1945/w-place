import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt-admin') {
  constructor(
    private readonly jwtService: JwtService,
    private readonly admin: number[],
  ) {
    super();
    this.admin = [18762];
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const token = this.getTokenFromHeader(request);

      if (!token) {
        throw new UnauthorizedException('토큰이 없습니다.');
      }

      const payload = await this.jwtService.verifyAsync(token);

      if (!this.checkAdmin(payload.sub)) {
        throw new UnauthorizedException('관리자가 아닙니다.');
      }

      request['user'] = { id: payload.sub, ...payload };

      return true;
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedException('토큰이 만료되었습니다.');
      }
      throw new UnauthorizedException('유효하지 않은 토큰입니다.', err.message);
    }
  }

  private getTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private checkAdmin(userId: number) {
    return this.admin.includes(userId);
  }
}
