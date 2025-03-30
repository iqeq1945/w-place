import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { RedisService } from 'src/redis/redis.service';
import { HttpException } from '@nestjs/common/exceptions/http.exception';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const token = this.getTokenFromHeader(request);

      if (!token) {
        throw new UnauthorizedException('토큰이 없습니다.');
      }

      const payload = await this.jwtService.verifyAsync(token);
      await this.checkBanUser(payload.sub);

      request['user'] = { id: payload.sub, ...payload };

      return true;
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedException('토큰이 만료되었습니다.');
      }
      if (err instanceof HttpException) {
        throw err;
      }
      throw new UnauthorizedException('유효하지 않은 토큰입니다.', err.message);
    }
  }

  private getTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private async checkBanUser(userId: string): Promise<void> {
    const ban = await this.redisService.getBanUser(userId);
    if (ban) {
      throw new ForbiddenException('블랙리스트에 등록된 유저입니다.');
    }
  }
}
