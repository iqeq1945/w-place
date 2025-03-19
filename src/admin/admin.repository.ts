import { Injectable } from '@nestjs/common';
import { ScyllaService } from '../scylla/scylla.service';

@Injectable()
export class AdminRepository {
  constructor(private scyllaService: ScyllaService) {}

  async executeQuery(query: string): Promise<Array<unknown>> {
    return await this.scyllaService.executeQuery(query);
  }
}
