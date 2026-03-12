import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'node:path';
import { MapsModule } from './maps/maps.module.js';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/ad_map_system'),
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'public'),
      exclude: ['/api/(.*)'],
    }),
    MapsModule,
  ],
})
export class AppModule {}