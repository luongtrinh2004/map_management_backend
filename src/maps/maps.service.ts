import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Region } from './schemas/region.schema';
import { Version, Asset } from './schemas/version.schema';
import { CreateRegionDto } from './dto/create-region.dto';
import { LaneletConverterService } from './lanelet-converter.service';
import { PcdOptimizerService } from './pcd-optimizer.service';
import * as fs from 'node:fs';
import * as path from 'node:path';

@Injectable()
export class MapsService {
  private readonly UPLOAD_DIR = 'maps';

  constructor(
    @InjectModel(Region.name) private regionModel: Model<Region>,
    @InjectModel(Version.name) private versionModel: Model<Version>,
    private readonly laneletConverter: LaneletConverterService,
    private readonly pcdOptimizer: PcdOptimizerService,
    private readonly configService: ConfigService,
  ) {
    if (!fs.existsSync(this.UPLOAD_DIR)) {
      fs.mkdirSync(this.UPLOAD_DIR, { recursive: true });
    }
  }

  async getStats() {
    const totalRegions = await this.regionModel.countDocuments().exec();
    const totalVersions = await this.versionModel.countDocuments().exec();
    const latestVersion = await this.versionModel
      .findOne()
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return {
      totalRegions,
      totalVersions,
      lastUpdated: latestVersion ? (latestVersion as any).createdAt : null,
    };
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

    let actualVersionName = versionName;
    if (!/^v/i.test(actualVersionName)) {
      actualVersionName = 'v' + actualVersionName;
    }

    const latestVersion = await this.versionModel
      .findOne({ region_id: region._id })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (latestVersion) {
      if (this.compareVersions(actualVersionName, latestVersion.version_name) <= 0) {
        throw new BadRequestException(`Tên version mới phải lớn hơn version hiện tại (${latestVersion.version_name})`);
      }
    }

    const versionDir = path.join(this.UPLOAD_DIR, region.code, actualVersionName);
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
    } else if (latestVersion) {
      const prevOsm = latestVersion.assets?.find(a => a.asset_type === 'OSM');
      if (prevOsm) {
        assets.push({
          asset_type: 'OSM',
          file_path: prevOsm.file_path,
          file_name: prevOsm.file_name,
        });
      }
    }

    if (files.pcd_file?.[0]) {
      saveFile(files.pcd_file[0], 'PCD');
    } else if (latestVersion) {
      const prevPcd = latestVersion.assets?.find(a => a.asset_type === 'PCD');
      if (prevPcd) {
        assets.push({
          asset_type: 'PCD',
          file_path: prevPcd.file_path,
          file_name: prevPcd.file_name,
        });
      }
    }

    // Phase 3: Smart Diff Analysis Computation
    const analysis: Record<string, any> = {};
    try {
      const newOsmAsset = assets.find(a => a.asset_type === 'OSM');
      const latestVersionOsm = latestVersion?.assets?.find(a => a.asset_type === 'OSM');

      if (newOsmAsset) {
        const newSummary = await this.laneletConverter.getOsmSummary(newOsmAsset.file_path as string);
        if (newSummary) {
          if (latestVersion && latestVersionOsm) {
            const prevSummary = await this.laneletConverter.getOsmSummary(latestVersionOsm.file_path as string);
            if (prevSummary) {
              analysis.osmNodesDiff = newSummary.nodeCount - prevSummary.nodeCount;
              analysis.osmWaysDiff = newSummary.wayCount - prevSummary.wayCount;
              analysis.osmTrafficLightsDiff = newSummary.trafficLightCount - prevSummary.trafficLightCount;
              analysis.osmTrafficSignsDiff = newSummary.trafficSignCount - prevSummary.trafficSignCount;
            }
          } else {
            analysis.osmNodesDiff = newSummary.nodeCount;
            analysis.osmWaysDiff = newSummary.wayCount;
            analysis.osmTrafficLightsDiff = newSummary.trafficLightCount;
            analysis.osmTrafficSignsDiff = newSummary.trafficSignCount;
            analysis.isInitial = true;
          }
        }
      }

      // Compare PCD
      const newPcdAsset = assets.find(a => a.asset_type === 'PCD');
      const latestVersionPcd = latestVersion?.assets?.find(a => a.asset_type === 'PCD');

      if (newPcdAsset) {
        const newPcdSummary = await this.pcdOptimizer.getPcdSummary(newPcdAsset.file_path as string);
        if (newPcdSummary) {
          if (latestVersion && latestVersionPcd) {
            const prevPcdSummary = await this.pcdOptimizer.getPcdSummary(latestVersionPcd.file_path as string);
            if (prevPcdSummary) {
              analysis.pcdPointsDiff = newPcdSummary.pointCount - prevPcdSummary.pointCount;
              const sizeDiffPercent = prevPcdSummary.fileSize > 0 ? ((newPcdSummary.fileSize - prevPcdSummary.fileSize) / prevPcdSummary.fileSize) * 100 : 0;
              analysis.pcdSizeDiffPercent = parseFloat(sizeDiffPercent.toFixed(2));
            }
          } else {
            analysis.pcdPointsCount = newPcdSummary.pointCount;
            analysis.pcdSize = newPcdSummary.fileSize;
          }
        }
      }

      analysis.isAligned = !!(assets.find(a => a.asset_type === 'OSM') && assets.find(a => a.asset_type === 'PCD'));
    } catch (err) {
      console.error('Failed to compute smart diff analysis:', err);
    }

    const versionData = {
      region_id: region._id,
      version_name: actualVersionName,
      ...metadata,
      assets,
      analysis,
    };

    const newVersion = new this.versionModel(versionData);
    const savedVersion = await newVersion.save();

    // Write metadata.json
    const metadataContent = {
      region: region.code,
      version: actualVersionName,
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
        const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:6060';
        v.assets.forEach((a) => {
          downloads[a.asset_type] = `${baseUrl}/api/downloads/${vId}/${a.asset_type}`;
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
        analysis: v.analysis,
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
      const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:6060';
      latestVersion.assets.forEach((a) => {
        downloads[a.asset_type] = `${baseUrl}/api/downloads/${vId}/${a.asset_type}`;
      });
    }

    return {
      region: regionCode,
      version: latestVersion.version_name,
      downloads,
    };
  }

  async getLaneletPreview(versionId: string): Promise<any> {
    const version = await this.versionModel.findById(versionId).exec();
    if (!version) throw new NotFoundException('Version not found');

    const osmAsset = version.assets.find(a => a.asset_type === 'OSM');
    if (!osmAsset) throw new NotFoundException('No OSM asset found for this version');

    return this.laneletConverter.convertToGeoJSON(osmAsset.file_path);
  }

  async getPcdPreviewPath(versionId: string): Promise<string> {
    const version = await this.versionModel.findById(versionId).exec();
    if (!version) throw new NotFoundException('Version not found');

    const asset = version.assets.find(a => a.asset_type === 'PCD');
    if (!asset || !fs.existsSync(asset.file_path)) {
      throw new NotFoundException('PCD Asset not found');
    }

    // Try to return optimized preview, fallback to original if fail
    return this.pcdOptimizer.createPreview(asset.file_path, 10);
  }

  private compareVersions(v1: string, v2: string): number {
    const normalize = (v: string) => v.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const parts1 = normalize(v1);
    const parts2 = normalize(v2);

    const maxLength = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < maxLength; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  async updateVersionStatus(versionId: string, status: string) {
    const version = await this.versionModel.findByIdAndUpdate(
      versionId,
      { status },
      { new: true },
    );
    if (!version) {
      throw new NotFoundException('Version not found');
    }
    return { success: true, status: version.status };
  }

  async rollbackVersion(versionId: string) {
    const oldVersion = await this.versionModel.findById(versionId).exec();
    if (!oldVersion) throw new NotFoundException('Target version not found');

    const region = await this.regionModel.findById(oldVersion.region_id).exec();
    if (!region) throw new NotFoundException('Region not found');

    const latestVersion = await this.versionModel
      .findOne({ region_id: region._id })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    let newVersionName = 'v1.0';
    if (latestVersion) {
      const parts = latestVersion.version_name.replace(/^v/i, '').split('.').map(Number);
      parts[parts.length - 1] += 1;
      newVersionName = 'v' + parts.join('.');
    }

    const versionDir = path.join(this.UPLOAD_DIR, region.code, newVersionName);
    fs.mkdirSync(versionDir, { recursive: true });

    const assets: Partial<Asset>[] = [];

    // Copy assets from old version
    for (const asset of oldVersion.assets) {
      const newFilePath = path.join(versionDir, asset.file_name);
      if (fs.existsSync(asset.file_path)) {
        fs.copyFileSync(asset.file_path, newFilePath);
        assets.push({
          asset_type: asset.asset_type,
          file_name: asset.file_name,
          file_path: newFilePath,
        });
      }
    }

    const versionData = {
      region_id: region._id,
      version_name: newVersionName,
      status: 'STABLE',
      creator: 'Auto-Rollback',
      utm_zone: oldVersion.utm_zone,
      mgrs_zone: oldVersion.mgrs_zone,
      coordinate_system: oldVersion.coordinate_system,
      description: `Auto-Rollback from ${oldVersion.version_name}`,
      assets,
      analysis: {
        isInitial: false,
        rollbackFrom: oldVersion.version_name
      }
    };

    const newVersionModel = new this.versionModel(versionData);
    await newVersionModel.save();

    const metadataContent = {
      region: region.code,
      version: newVersionName,
      created_at: new Date().toISOString().split('T')[0],
      creator: versionData.creator,
      description: versionData.description
    };
    
    fs.writeFileSync(path.join(versionDir, 'metadata.json'), JSON.stringify(metadataContent, null, 2));

    return { success: true, new_version: newVersionName };
  }
}
