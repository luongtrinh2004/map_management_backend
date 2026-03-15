import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';

@Injectable()
export class PcdOptimizerService {
  private readonly logger = new Logger(PcdOptimizerService.name);

  async createPreview(originalPath: string, percent: number = 10): Promise<string> {
    const dir = path.dirname(originalPath);
    const filename = path.basename(originalPath, '.pcd');
    const previewPath = path.join(dir, `${filename}_preview.pcd`);

    if (fs.existsSync(previewPath)) {
      return previewPath; // Already optimized
    }

    try {
      this.logger.log(`Downsampling ${originalPath}...`);
      await this.downsamplePcd(originalPath, previewPath, percent);
      this.logger.log(`Downsample completed: ${previewPath}`);
      return previewPath;
    } catch (err: any) {
      this.logger.error(`Error downsampling PCD: ${err.message}`);
      // Fallback to original
      return originalPath;
    }
  }

  async getPcdSummary(filePath: string): Promise<any> {
    if (!fs.existsSync(filePath)) return null;
    try {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(1024); // PCD header is usually small
      fs.readSync(fd, buffer, 0, 1024, 0);
      fs.closeSync(fd);

      const content = buffer.toString('utf-8');
      const pointsLine = content.split('\n').find(l => l.startsWith('POINTS'));
      if (!pointsLine) return null;

      const points = parseInt(pointsLine.split(' ')[1], 10);
      return {
        pointCount: points,
        fileSize: fs.statSync(filePath).size
      };
    } catch (e) {
      return null;
    }
  }

  private async downsamplePcd(inputPath: string, outputPath: string, percent: number): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.readFile(inputPath, (err, data) => {
        if (err) return reject(err);

        try {
          const headerEndIndex = data.indexOf('\n', data.indexOf('DATA '));
          if (headerEndIndex === -1) return reject(new Error('Invalid PCD format'));

          const headerStr = data.toString('utf-8', 0, headerEndIndex + 1);
          const headerLines = headerStr.trim().split(/\r?\n/);
          
          let format = 'ascii';
          let originalPoints = 0;
          let sizes: number[] = [];
          let counts: number[] = [];

          for (const line of headerLines) {
            if (line.startsWith('POINTS')) originalPoints = parseInt(line.split(' ')[1], 10);
            if (line.startsWith('SIZE')) sizes = line.split(' ').slice(1).map(Number);
            if (line.startsWith('COUNT')) counts = line.split(' ').slice(1).map(Number);
            if (line.startsWith('DATA')) format = line.split(' ')[1].trim();
          }

          const strideRatio = Math.max(1, Math.floor(100 / percent));
          const newPointsCount = Math.ceil(originalPoints / strideRatio);

          const newHeaderStr = headerLines.map(hl => {
            if (hl.startsWith('POINTS') || hl.startsWith('WIDTH')) {
              const parts = hl.split(' ');
              return `${parts[0]} ${newPointsCount}`;
            }
            return hl;
          }).join('\n') + '\n';

          const outFd = fs.openSync(outputPath, 'w');
          fs.writeSync(outFd, newHeaderStr);

          const payloadOffset = headerEndIndex + 1;

          if (format === 'binary') {
            const stride = sizes.reduce((acc, size, i) => acc + (size * (counts[i] || 1)), 0);
            for (let i = 0; i < originalPoints; i += strideRatio) {
              const pointOffset = payloadOffset + i * stride;
              const pointEnd = Math.min(pointOffset + stride, data.length);
              if (pointOffset < data.length) {
                fs.writeSync(outFd, data.subarray(pointOffset, pointEnd));
              }
            }
          } else if (format === 'ascii') {
            const payloadStr = data.toString('utf-8', payloadOffset);
            const lines = payloadStr.trim().split(/\r?\n/);
            for (let i = 0; i < lines.length; i += strideRatio) {
              if (lines[i]) {
                fs.writeSync(outFd, lines[i] + '\n');
              }
            }
          } else {
            fs.closeSync(outFd);
            return reject(new Error(`Format ${format} not supported for simple downsampling`));
          }

          fs.closeSync(outFd);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  }
}
