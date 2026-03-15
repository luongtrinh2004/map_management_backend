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
    
    nodeElements.forEach((n: any) => {
      // Handle both direct attributes and prefixed attributes (e.g. from different parser settings)
      const id = (n.id || n['@_id'])?.toString();
      const lon = parseFloat(n.lon || n['@_lon']);
      const lat = parseFloat(n.lat || n['@_lat']);
      
      if (id && !isNaN(lon) && !isNaN(lat)) {
        nodesMap.set(id, [lon, lat]);
      }
    });

    const features: any[] = [];

    // Process Nodes for Traffic Elements (Points)
    nodeElements.forEach((n: any) => {
      const tags = this.parseTags(n.tag);
      // Lanelet2 often puts traffic information on nodes
      if (tags.type === 'traffic_light' || tags.subtype === 'traffic_sign' || tags.type === 'traffic_sign' || tags.stop_line === 'yes') {
        const id = (n.id || n['@_id'])?.toString();
        const coord = nodesMap.get(id);
        if (coord) {
          features.push({
            type: 'Feature',
            properties: {
              id,
              element_type: 'point',
              ...tags
            },
            geometry: {
              type: 'Point',
              coordinates: coord
            }
          });
        }
      }
    });

    // Process Ways
    const wayElements = Array.isArray(osm.way) ? osm.way : [osm.way].filter(Boolean);
    wayElements.forEach((w: any) => {
      const coords: [number, number][] = [];
      const ndElements = Array.isArray(w.nd) ? w.nd : [w.nd].filter(Boolean);
      
      ndElements.forEach((nd: any) => {
        const ref = (nd.ref || nd['@_ref'])?.toString();
        const coord = nodesMap.get(ref);
        if (coord) coords.push(coord);
      });

      if (coords.length > 1) {
        const tags = this.parseTags(w.tag);
        
        // Categorize way type for coloring
        let displayType = 'other';
        if (tags.type === 'line_thin' || tags.type === 'line_thick' || tags.subtype === 'solid' || tags.subtype === 'dashed') {
           displayType = 'boundary';
        } else if (tags.lane_change === 'yes' || tags.virtual === 'yes') {
           displayType = 'virtual';
        } else if (tags.type === 'curbstone' || tags.type === 'guard_rail') {
           displayType = 'obstacle';
        } else if (tags.type === 'stop_line' || tags.subtype === 'stop_line') {
           displayType = 'stop_line';
        }

        features.push({
          type: 'Feature',
          properties: {
            id: w.id || w['@_id'],
            element_type: 'way',
            display_type: displayType,
            ...tags
          },
          geometry: {
            type: 'LineString',
            coordinates: coords
          }
        });
      }
    });

    console.log(`Converted OSM to GeoJSON: ${nodesMap.size} nodes, ${features.length} features.`);

    return {
      type: 'FeatureCollection',
      features
    };
  }

  async getOsmSummary(filePath: string): Promise<any> {
    if (!fs.existsSync(filePath)) return null;
    try {
      const xmlData = fs.readFileSync(filePath, 'utf-8');
      const jsonObj = this.parser.parse(xmlData);
      const osm = jsonObj.osm;
      if (!osm) return null;

      const nodes = Array.isArray(osm.node) ? osm.node : [osm.node].filter(Boolean);
      const ways = Array.isArray(osm.way) ? osm.way : [osm.way].filter(Boolean);
      const relations = Array.isArray(osm.relation) ? osm.relation : [osm.relation].filter(Boolean);

      let trafficLights = 0;
      let trafficSigns = 0;
      nodes.forEach((n: any) => {
        const tags = this.parseTags(n.tag);
        if (tags.type === 'traffic_light' || tags.subtype === 'traffic_light') trafficLights++;
        if (tags.type === 'traffic_sign' || tags.subtype === 'traffic_sign') trafficSigns++;
      });

      return {
        nodeCount: nodes.length,
        wayCount: ways.length,
        relationCount: relations.length,
        trafficLightCount: trafficLights,
        trafficSignCount: trafficSigns,
      };
    } catch (e) {
      return null;
    }
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
