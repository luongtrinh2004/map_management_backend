import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Region } from './schemas/region.schema';
import { Version, Asset } from './schemas/version.schema';
import { CreateRegionDto } from './dto/create-region.dto';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

  async createRegion(dto: CreateRegionDto): Promise<any> {
    const region = new this.regionModel(dto);
    const saved = await region.save();
    return {
      id: (saved._id).toString(),
      name: saved.name,
      code: saved.code,
    };
  }

  async findAllRegions(): Promise<any[]> {
    const regions = await this.regionModel.find().exec();
    return regions.map((r) => ({
      id: (r._id).toString(),
      name: r.name,
      code: r.code,
    }));
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

    const assets: Partial<Asset>[] = [];

    const saveFile = (multerFile: Express.Multer.File, type: string) => {
      const filePath = path.join(versionDir, multerFile.originalname);
      fs.writeFileSync(filePath, multerFile.buffer);
      assets.push({
        asset_type: type,
        file_path: filePath,
        file_name: multerFile.originalname,
      });
    };

    if (files.osm_file?.[0]) {
      saveFile(files.osm_file[0], 'OSM');
    }
    if (files.pcd_file?.[0]) {
      saveFile(files.pcd_file[0], 'PCD');
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

    return { status: 'success', version_id: (savedVersion._id).toString() };
  }

  async getVersions(regionCode: string) {
    const region = await this.regionModel.findOne({ code: regionCode });
    if (!region) {
      throw new NotFoundException('Region not found');
    }

    // Use lean to avoid complex document types for this mapped response
    const versions = await this.versionModel
      .find({ region_id: region._id })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return versions.map((v) => {
      const downloads: Record<string, string> = {};
      const vId = (v._id).toString();
      
      if (v.assets) {
        v.assets.forEach((a) => {
          downloads[a.asset_type] = `http://localhost:6060/api/downloads/${vId}/${a.asset_type}`;
        });
      }

      return {
        id: vId,
        version: v.version_name,
        status: v.status,
        created_at: (v as any).createdAt || (v as any).created_at,
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
    const version = await this.versionModel.findById(versionId).exec();
    if (!version) throw new NotFoundException('Version not found');
    
    const asset = version.assets.find((a) => a.asset_type === assetType);
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
    })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

    if (!latestVersion) {
      throw new NotFoundException('No stable maps uploaded');
    }

    const downloads: Record<string, string> = {};
    const vId = (latestVersion._id).toString();

    if (latestVersion.assets) {
      latestVersion.assets.forEach((a) => {
        downloads[a.asset_type] = `http://localhost:6060/api/downloads/${vId}/${a.asset_type}`;
      });
    }

    return {
      region: regionCode,
      version: latestVersion.version_name,
      downloads,
    };
  }
}
