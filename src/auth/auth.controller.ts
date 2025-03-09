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
