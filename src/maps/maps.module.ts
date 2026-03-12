import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MapsController } from './maps.controller.js';
import { MapsService } from './maps.service.js';
import { Region, RegionSchema } from './schemas/region.schema.js';
import { Version, VersionSchema } from './schemas/version.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Region.name, schema: RegionSchema },
      { name: Version.name, schema: VersionSchema },
    ]),
  ],
  controllers: [MapsController],
  providers: [MapsService],
})
export class MapsModule {}
