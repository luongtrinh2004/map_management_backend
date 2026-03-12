import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Region } from './schemas/region.schema';
import { Version } from './schemas/version.schema';
import { CreateRegionDto } from './dto/create-region.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MapsService {
  private readonly UPLOAD_DIR = 'maps';

  constructor(
    @InjectModel(Region.name) private regionModel: Model<Region>,
    @InjectModel(Version.name) private versionModel: Model<Version>,
  ) {
    if (!fs.existsSync(this.UPLOAD_DIR)) {
      fs.mkdirSync(this.UPLOAD_DIR, { recursive: true });
    }
  }

  async createRegion(dto: CreateRegionDto): Promise<Region> {
    const region = new this.regionModel(dto);
    return region.save();
  }

  async findAllRegions(): Promise<Region[]> {
    return this.regionModel.find().exec();
  }

  async uploadVersion(
    regionCode: string,
    versionName: string,
    metadata: {
      creator?: string;
      utm_zone?: string;
      mgrs_zone?: string;
      coordinate_system?: string;
      description?: string;
    },
    files: { osm_file?: Express.Multer.File[]; pcd_file?: Express.Multer.File[] },
  ) {
    const region = await this.regionModel.findOne({ code: regionCode });
    if (!region) {
      throw new NotFoundException('Region not found');
    }

    const versionDir = path.join(this.UPLOAD_DIR, region.code, versionName);
    fs.mkdirSync(versionDir, { recursive: true });

    const assets: any[] = [];

    const saveFile = async (multerFile: Express.Multer.File, type: string) => {
      const filePath = path.join(versionDir, multerFile.originalname);
      fs.writeFileSync(filePath, multerFile.buffer);
      assets.push({
        asset_type: type,
        file_path: filePath,
        file_name: multerFile.originalname,
      });
    };

    if (files.osm_file?.[0]) {
      await saveFile(files.osm_file[0], 'OSM');
    }
    if (files.pcd_file?.[0]) {
      await saveFile(files.pcd_file[0], 'PCD');
    }

    const versionData = {
      region_id: region._id,
      version_name: versionName,
      ...metadata,
      assets,
    };

    const newVersion = new this.versionModel(versionData);
    const savedVersion = await newVersion.save();

    // Write metadata.json
    const metadataContent = {
      region: region.code,
      version: versionName,
      created_at: new Date().toISOString().split('T')[0],
      creator: metadata.creator || 'mapping_team',
      utm_zone: metadata.utm_zone || '',
      mgrs_zone: metadata.mgrs_zone || '',
      coordinate_system: metadata.coordinate_system || '',
      description: metadata.description || ''
    };
    
    const metadataPath = path.join(versionDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadataContent, null, 2));

    return { status: 'success', version_id: savedVersion._id };
  }

  async getVersions(regionCode: string) {
    const region = await this.regionModel.findOne({ code: regionCode });
    if (!region) {
      throw new NotFoundException('Region not found');
    }

    const versions = await this.versionModel.find({ region_id: region._id }).sort({ createdAt: -1 }).exec();

    return versions.map((v) => {
      const downloads: Record<string, string> = {};
      v.assets.forEach((a) => {
        // We use the temporary id or index for download because in sub-documents _id is different
        // For simplicity with the existing FE, we'll keep the logic but we need a way to serve file
        // In Mongoose sub-docs, we can get the sub-doc id
        // Wait, for simplicity let's use a convention or serve by path. 
        // But the previous API used downloads/:id. Let's make it work.
        downloads[a.asset_type] = `http://localhost:6060/api/downloads/${v._id}/${a.asset_type}`;
      });
      return {
        id: v._id,
        version: v.version_name,
        status: v.status,
        created_at: (v as any).createdAt,
        creator: v.creator,
        utm_zone: v.utm_zone,
        mgrs_zone: v.mgrs_zone,
        coordinate_system: v.coordinate_system,
        description: v.description,
        downloads,
      };
    });
  }

  async getAsset(versionId: string, assetType: string) {
    const version = await this.versionModel.findById(versionId);
    if (!version) throw new NotFoundException('Version not found');
    
    const asset = version.assets.find(a => a.asset_type === assetType);
    if (!asset || !fs.existsSync(asset.file_path)) {
      throw new NotFoundException('File not found');
    }
    return asset;
  }

  async getLatestMap(regionCode: string) {
    const region = await this.regionModel.findOne({ code: regionCode });
    if (!region) {
        throw new NotFoundException('Region not found');
    }

    const latestVersion = await this.versionModel.findOne({
      region_id: region._id,
      status: 'STABLE'
    }).sort({ createdAt: -1 }).exec();

    if (!latestVersion) {
      throw new NotFoundException('No stable maps uploaded');
    }

    const downloads: Record<string, string> = {};
    latestVersion.assets.forEach((a) => {
      downloads[a.asset_type] = `http://localhost:6060/api/downloads/${latestVersion._id}/${a.asset_type}`;
    });

    return {
      region: regionCode,
      version: latestVersion.version_name,
      downloads,
    };
  }
}
