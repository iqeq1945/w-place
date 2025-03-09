import { Module } from '@nestjs/common';
import { WakgamesService } from './wakgames.service';

@Module({
  providers: [WakgamesService],
  exports: [WakgamesService],
})
export class WakgamesModule {}
