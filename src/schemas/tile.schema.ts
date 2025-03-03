import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Tile extends Document {
  @Prop({ required: true })
  x: number;

  @Prop({ required: true })
  y: number;

  @Prop({ required: true })
  colorIndex: number;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  timestamp: number;
}

export const TileSchema = SchemaFactory.createForClass(Tile);

TileSchema.index({ x: 1, y: 1 });
