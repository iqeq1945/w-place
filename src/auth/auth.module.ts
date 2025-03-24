import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { WakgamesModule } from 'src/wakgames/wakgames.module';
import { AuthController } from './auth.controller';
import { RedisModule } from 'src/redis/redis.module';
import { JwtAuthGuard } from './auth.guard';
@Module({
  imports: [WakgamesModule, RedisModule],
  providers: [AuthService, JwtAuthGuard],
  controllers: [AuthController],
})
export class AuthModule {}
