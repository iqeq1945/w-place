import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OauthService } from 'src/oauth/oauth.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly oauthService: OauthService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async waktaOauth() {
    return this.oauthService.getAuth();
  }

  async waktaLogin(code: string, codeVerifier: string) {
    const tokenResponse = await this.oauthService.getToken(code, codeVerifier);

    if (!tokenResponse.data) {
      throw new UnauthorizedException('OAuth 인증에 실패했습니다');
    }

    const { accessToken } = tokenResponse.data;

    const profileResponse = await this.oauthService.getProfile(accessToken);

    if (!profileResponse.data) {
      throw new UnauthorizedException('Profile 정보획득 실패');
    }

    const userProfile = profileResponse.data;

    await this.checkBanUser(userProfile.id);

    const jwtPayload = this.createJwtPayload(userProfile);
    const userAccessToken = this.jwtService.sign(jwtPayload);

    return {
      accessToken: userAccessToken,
      user: userProfile,
    };
  }

  private createJwtPayload(user: any) {
    const payload = {
      sub: user.id,
      name: user.name,
      profileImg: user.profileImag,
    };

    return payload;
  }

  async checkBanUser(userId: string): Promise<void> {
    const ban = await this.redisService.getBanUser(userId);
    if (ban) {
      throw new UnauthorizedException('블랙리스트에 등록된 유저입니다.');
    }
  }
}
