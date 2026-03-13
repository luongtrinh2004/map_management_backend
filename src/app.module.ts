import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MapsModule } from './maps/maps.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/ad_map_system'),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      exclude: ['/api/:path*'],
    }),
    MapsModule,
  ],
})
export class AppModule {}
