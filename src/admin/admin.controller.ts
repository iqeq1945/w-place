import { Body, Controller, Inject, Post } from '@nestjs/common';
import { QueryBodyDto } from './dto/query-body.dto';
import { AdminRepository } from './admin.repository';

@Controller('admin')
export class AdminController {
  constructor(
    @Inject(AdminRepository) private readonly adminRepository: AdminRepository,
  ) {}

  @Post('query')
  async query(@Body() body: QueryBodyDto) {
    return this.adminRepository.executeQuery(body.query);
  }
}
