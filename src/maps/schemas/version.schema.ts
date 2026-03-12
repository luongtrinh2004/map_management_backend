import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class Asset {
  @Prop({ required: true })
  asset_type: string; // 'OSM' or 'PCD'

  @Prop({ required: true })
  file_path: string;

  @Prop({ required: true })
  file_name: string;
}

export const AssetSchema = SchemaFactory.createForClass(Asset);

@Schema({ timestamps: true })
export class Version extends Document {
  @Prop({ required: true })
  version_name: string;

  @Prop({ default: 'STABLE' })
  status: string;

  @Prop()
  creator: string;

  @Prop()
  utm_zone: string;

  @Prop()
  mgrs_zone: string;

  @Prop()
  coordinate_system: string;

  @Prop()
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'Region', required: true })
  region_id: Types.ObjectId;

  @Prop({ type: [AssetSchema], default: [] })
  assets: Asset[];
}

export const VersionSchema = SchemaFactory.createForClass(Version);
