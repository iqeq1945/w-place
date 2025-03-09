import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { WakgamesModule } from 'src/wakgames/wakgames.module';
import { AuthController } from './auth.controller';

@Module({
  imports: [WakgamesModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
