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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  async waktaOauth(@Session() session) {
    const data = await this.authService.waktaOauth();
    session.data = data;
    return data;
  }

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
