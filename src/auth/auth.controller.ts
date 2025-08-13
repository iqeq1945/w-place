import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  Res,
  Session,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'oauth',
    description: '인증 URL로 이동하여 로그인 진행',
  })
  @Get()
  async waktaOauth() {
    return await this.authService.waktaOauth();
  }

  @ApiOperation({
    summary: 'oauth callback',
    description: '로그인 성공 시 사용자 정보와 토큰 정보를 반환',
  })
  @ApiQuery({
    name: 'code',
    type: Number,
    description: '/auth 에서 받은 code',
  })
  @ApiQuery({
    name: 'codeVerifier',
    type: Number,
    description: '/auth 에서 받은 verifier',
  })
  @Get('callback')
  async waktaCallback(@Query() query, @Res() res) {
    if (query.code) {
      const data = await this.authService.waktaLogin(
        query.code,
        query.codeVerifier,
      );

      return res.json(data);
    } else throw new BadRequestException();
  }
}
