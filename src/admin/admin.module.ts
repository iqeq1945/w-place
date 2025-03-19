import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminRepository } from './admin.repository';
import { ScyllaModule } from '../scylla/scylla.module';

@Module({
  imports: [ScyllaModule],
  controllers: [AdminController],
  providers: [AdminRepository],
})
export class AdminModule {}
