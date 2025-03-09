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
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'waktaver games oauth',
    description: '반한되는 정보의 url로 이동하여 로그인 진행',
  })
  @Get()
  async waktaOauth(@Session() session) {
    const data = await this.authService.waktaOauth();
    session.data = data;
    return data;
  }

  @ApiOperation({
    summary: 'waktaver games oauth callback',
    description: '로그인 성공시 user 정보와 token 정보를 줌',
  })
  @Get('callback')
  async waktaCallback(@Query() query, @Res() res, @Session() session) {
    if (query.code) {
      const user = await this.authService.waktaLogin(
        query.code,
        session.data.codeVerifier,
      );

      delete session.data;

      return res.json(user);
    } else throw new BadRequestException();
  }
}
