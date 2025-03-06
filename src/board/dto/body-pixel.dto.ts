import { IsNumber, Min, Max } from 'class-validator';

export class BodyPixelDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  @Min(0)
  @Max(15)
  colorIndex: number;
}
