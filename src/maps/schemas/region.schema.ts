import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Region extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  code: string;
}

export const RegionSchema = SchemaFactory.createForClass(Region);
