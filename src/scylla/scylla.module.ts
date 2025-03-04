import { Module } from '@nestjs/common';
import { ScyllaService } from './scylla.service';

@Module({
  providers: [ScyllaService],
  exports: [ScyllaService],
})
export class ScyllaModule {}
