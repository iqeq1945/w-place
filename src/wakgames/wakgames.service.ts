import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WakGames } from '@wakgames/backend-sdk';

type grantType = 'authorization_code';

@Injectable()
export class WakgamesService extends WakGames {
  constructor(private readonly configService: ConfigService) {
    super({
      clientId: configService.get<string>('CLIENT_ID'),
      redirectUrl: configService.get<string>('CALLBACK_URL'),
    });
  }

  getAuth(): object {
    return this.oauth.getAuthorizeUrl();
  }

  async getToken(auth) {
    const query = {
      grantType: 'authorization_code' as grantType,
      clientId: this.clientId,
      code: auth.code,
      verifier: auth.codeVerifier,
      callbackUri: this.redirectUrl,
    };
    return await this.oauth.token(query);
  }

  async updateToken(refreshToken: string) {
    return await this.oauth.refresh(refreshToken);
  }

  async getProfile(accessToken: string) {
    return await this.gameLink.getProfile(accessToken);
  }

  async getAchieve(accessToken: string) {
    return await this.gameLink.getAchieves(accessToken);
  }

  async postAchieve(query: any, accessToken: string) {
    return await this.gameLink.postAchieve(query, accessToken);
  }

  async getStat(query, accessToken: string) {
    return await this.gameLink.getStat(query, accessToken);
  }

  async putStat(body: any, accessToken: string) {
    return await this.gameLink.putStat(body, accessToken);
  }
}
