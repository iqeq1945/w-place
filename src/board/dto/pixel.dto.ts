import { IsNumberString } from 'class-validator';

export class PixelDto {
  @IsNumberString()
  x: string;

  @IsNumberString()
  y: string;
}
