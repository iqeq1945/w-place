import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WakgamesService } from 'src/wakgames/wakgames.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly wakgamesService: WakgamesService,
    private readonly jwtService: JwtService,
  ) {}

  async waktaOauth() {
    return this.wakgamesService.getAuth();
  }

  async waktaLogin(code: string, codeVerifier: string) {
    const tokenResponse = await this.wakgamesService.getToken(
      code,
      codeVerifier,
    );

    if (!tokenResponse.data) {
      throw new UnauthorizedException('OAuth 인증에 실패했습니다');
    }

    const { accessToken } = tokenResponse.data;

    const profileResponse = await this.wakgamesService.getProfile(accessToken);

    if (!profileResponse.data) {
      throw new UnauthorizedException('Profile 정보획득 실패');
    }

    const userProfile = profileResponse.data;

    const jwtPayload = this.createJwtPayload(userProfile);
    const userAccessToken = this.jwtService.sign(jwtPayload);

    this.logger;
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
}
