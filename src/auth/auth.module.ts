import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OauthModule } from 'src/oauth/oauth.module';
import { AuthController } from './auth.controller';
import { RedisModule } from 'src/redis/redis.module';
import { JwtAuthGuard } from './auth.guard';
@Module({
  imports: [OauthModule, RedisModule],
  providers: [AuthService, JwtAuthGuard],
  controllers: [AuthController],
})
export class AuthModule {}
