import { IsString } from 'class-validator';

export class QueryBodyDto {
  /**
   * CQL query
   */
  @IsString()
  query: string;
}
