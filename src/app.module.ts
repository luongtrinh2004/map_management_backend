import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MapsModule } from './maps/maps.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/ad_map_system'),
    MapsModule,
  ],
})
export class AppModule {}
