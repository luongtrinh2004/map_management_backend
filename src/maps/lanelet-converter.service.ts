import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'node:fs';

@Injectable()
export class LaneletConverterService {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
  }

  async convertToGeoJSON(filePath: string): Promise<any> {
    if (!fs.existsSync(filePath)) {
      throw new Error('OSM file not found');
    }

    const xmlData = fs.readFileSync(filePath, 'utf-8');
    const jsonObj = this.parser.parse(xmlData);

    const osm = jsonObj.osm;
    if (!osm) {
      console.error('Invalid OSM format: missing osm root');
      throw new Error('Invalid OSM format');
    }

    const nodesMap = new Map<string, [number, number]>();
    const nodeElements = Array.isArray(osm.node) ? osm.node : [osm.node].filter(Boolean);
    console.log(`Parsing OSM: ${nodeElements.length} nodes found.`);
    
    nodeElements.forEach((n: any) => {
      const id = n.id?.toString();
      const lon = parseFloat(n.lon);
      const lat = parseFloat(n.lat);
      
      if (id && !isNaN(lon) && !isNaN(lat) && (lon !== 0 || lat !== 0)) {
        nodesMap.set(id, [lon, lat]);
      }
    });

    const features: any[] = [];

    // Process Ways
    const wayElements = Array.isArray(osm.way) ? osm.way : [osm.way].filter(Boolean);
    wayElements.forEach((w: any) => {
      const coords: [number, number][] = [];
      const nds = Array.isArray(w.nd) ? w.nd : [w.nd].filter(Boolean);
      
      nds.forEach((nd: any) => {
        const ref = nd.ref?.toString() || nd['@_ref']?.toString();
        const coord = nodesMap.get(ref);
        if (coord) coords.push(coord);
      });

      if (coords.length > 1) {
        const tags = this.parseTags(w.tag);
        features.push({
          type: 'Feature',
          properties: {
            id: w.id,
            type: 'way',
            ...tags
          },
          geometry: {
            type: 'LineString',
            coordinates: coords
          }
        });
      }
    });

    console.log(`Parsing OSM: ${features.length} features generated.`);

    return {
      type: 'FeatureCollection',
      features
    };
  }

  private parseTags(tags: any): Record<string, string> {
    const result: Record<string, string> = {};
    if (!tags) return result;
    
    const tagArray = Array.isArray(tags) ? tags : [tags];
    tagArray.forEach((t: any) => {
      if (t.k && t.v) {
        result[t.k] = t.v;
      }
    });
    return result;
  }
}
