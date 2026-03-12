import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MapsController } from './maps.controller';
import { MapsService } from './maps.service';
import { Region, RegionSchema } from './schemas/region.schema';
import { Version, VersionSchema } from './schemas/version.schema';

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