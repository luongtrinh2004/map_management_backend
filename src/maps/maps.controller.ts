import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseInterceptors,
  UploadedFiles,
  Res,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { MapsService } from './maps.service';
import { CreateRegionDto } from './dto/create-region.dto';
import type { Response } from 'express';

@Controller()
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Post('regions')
  createRegion(@Body() createRegionDto: CreateRegionDto) {
    return this.mapsService.createRegion(createRegionDto);
  }

  @Get('regions')
  findAllRegions() {
    return this.mapsService.findAllRegions();
  }

  @Post('versions/upload')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'osm_file', maxCount: 1 },
      { name: 'pcd_file', maxCount: 1 },
    ]),
  )
  uploadVersion(
    @Body('region_code') regionCode: string,
    @Body('version_name') versionName: string,
    @Body('creator') creator: string,
    @Body('utm_zone') utmZone: string,
    @Body('mgrs_zone') mgrsZone: string,
    @Body('coordinate_system') coordinateSystem: string,
    @Body('description') description: string,
    @UploadedFiles()
    files: { osm_file?: Express.Multer.File[]; pcd_file?: Express.Multer.File[] },
  ) {
    return this.mapsService.uploadVersion(
      regionCode,
      versionName,
      {
        creator,
        utm_zone: utmZone,
        mgrs_zone: mgrsZone,
        coordinate_system: coordinateSystem,
        description,
      },
      files,
    );
  }

  @Get('regions/:code/versions')
  getVersions(@Param('code') code: string) {
    return this.mapsService.getVersions(code);
  }

  @Get('downloads/:vId/:type')
  async downloadAsset(@Param('vId') vId: string, @Param('type') type: string, @Res() res: Response) {
    const asset = await this.mapsService.getAsset(vId, type);
    res.download(asset.file_path, asset.file_name);
  }

  @Get('maps/:code/latest')
  getLatestMap(@Param('code') code: string) {
    return this.mapsService.getLatestMap(code);
  }
}
