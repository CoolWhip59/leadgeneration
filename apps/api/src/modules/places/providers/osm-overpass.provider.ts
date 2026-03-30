import { Injectable, Logger } from '@nestjs/common';
import { fetch } from 'undici';
import { SimpleRateLimiter, withRetry } from '../../common/http.util';
import { PlaceResult, PlacesProvider } from './types';

const CATEGORY_TAGS: Record<string, Array<{ key: string; value: string }>> = {
  kuafor: [{ key: 'shop', value: 'hairdresser' }],
  berber: [{ key: 'shop', value: 'hairdresser' }],
  'oto-yikama': [{ key: 'amenity', value: 'car_wash' }],
  disci: [{ key: 'amenity', value: 'dentist' }],
  restoran: [{ key: 'amenity', value: 'restaurant' }],
  kafe: [{ key: 'amenity', value: 'cafe' }, { key: 'shop', value: 'coffee' }],
  eczane: [{ key: 'amenity', value: 'pharmacy' }],
  veteriner: [{ key: 'amenity', value: 'veterinary' }],
  'spor-salonu': [{ key: 'leisure', value: 'fitness_centre' }, { key: 'sport', value: 'fitness' }],
  'guzellik-merkezi': [{ key: 'shop', value: 'beauty' }, { key: 'beauty', value: 'salon' }],
};

const ALL_CATEGORY_SLUGS = new Set(['tum-isletmeler']);
const EXCLUDED_AMENITIES = new Set([
  'place_of_worship',
  'school',
  'college',
  'university',
  'kindergarten',
  'townhall',
  'courthouse',
  'police',
  'fire_station',
  'public_building',
  'government',
]);
const EXCLUDED_OFFICES = new Set(['government']);

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export class OsmOverpassProvider implements PlacesProvider {
  private readonly logger = new Logger(OsmOverpassProvider.name);
  private readonly endpoint = process.env.OVERPASS_ENDPOINT || 'https://overpass-api.de/api/interpreter';
  private readonly timeoutSec = Number(process.env.OVERPASS_TIMEOUT_SEC || 25);
  private readonly limiter = new SimpleRateLimiter(300);

  async search(
    city: { id: string; name: string; bbox: [number, number, number, number] },
    category: { name: string; slug: string },
  ) {
    const [south, west, north, east] = city.bbox;
    const query = ALL_CATEGORY_SLUGS.has(category.slug)
      ? this.buildAllBusinessesQuery(south, west, north, east)
      : this.buildCategoryQuery(category.slug, south, west, north, east);

    if (!query) {
      this.logger.warn(`No OSM tag mapping for category ${category.slug}`);
      return [] as PlaceResult[];
    }

    await this.limiter.wait();

    const response = await withRetry(() =>
      fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: query,
      }),
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Overpass error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { elements: OverpassElement[] };
    const elements = data?.elements || [];

    return elements
      .map((element) => this.toPlaceResult(element))
      .filter((item): item is PlaceResult => Boolean(item));
  }

  private buildCategoryQuery(
    slug: string,
    south: number,
    west: number,
    north: number,
    east: number,
  ): string | null {
    const tags = CATEGORY_TAGS[slug];
    if (!tags || tags.length === 0) {
      return null;
    }

    const tagQueries = tags
      .map(
        (tag) =>
          `  node["${tag.key}"="${tag.value}"](${south},${west},${north},${east});\n  way["${tag.key}"="${tag.value}"](${south},${west},${north},${east});\n  relation["${tag.key}"="${tag.value}"](${south},${west},${north},${east});`,
      )
      .join('\n');

    return `
[out:json][timeout:${this.timeoutSec}];
(
${tagQueries}
);
out center tags;
`;
  }

  private buildAllBusinessesQuery(south: number, west: number, north: number, east: number): string {
    return `
[out:json][timeout:${this.timeoutSec}];
(
  node["name"]["shop"](${south},${west},${north},${east});
  way["name"]["shop"](${south},${west},${north},${east});
  relation["name"]["shop"](${south},${west},${north},${east});
  node["name"]["amenity"](${south},${west},${north},${east});
  way["name"]["amenity"](${south},${west},${north},${east});
  relation["name"]["amenity"](${south},${west},${north},${east});
  node["name"]["office"](${south},${west},${north},${east});
  way["name"]["office"](${south},${west},${north},${east});
  relation["name"]["office"](${south},${west},${north},${east});
  node["name"]["craft"](${south},${west},${north},${east});
  way["name"]["craft"](${south},${west},${north},${east});
  relation["name"]["craft"](${south},${west},${north},${east});
  node["name"]["tourism"](${south},${west},${north},${east});
  way["name"]["tourism"](${south},${west},${north},${east});
  relation["name"]["tourism"](${south},${west},${north},${east});
);
out center tags;
`;
  }

  private toPlaceResult(element: OverpassElement): PlaceResult | null {
    const tags = element.tags || {};
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (lat === undefined || lng === undefined) return null;

    const name = tags.name || tags['brand'] || tags['operator'];
    if (!name) return null;
    if (this.isExcludedInstitutionByTags(tags)) return null;

    const phone = tags['phone'] || tags['contact:phone'];
    const website = tags['website'] || tags['contact:website'] || tags['url'];

    const addressParts = [
      tags['addr:street'],
      tags['addr:housenumber'],
      tags['addr:district'],
      tags['addr:city'],
      tags['addr:province'],
      tags['addr:postcode'],
    ].filter(Boolean);

    const address = addressParts.join(' ').trim() || 'N/A';

    return {
      externalId: `osm:${element.type}:${element.id}`,
      source: 'osm',
      name,
      address,
      phone,
      websiteUrl: website,
      googleMapsUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      rating: null,
      lat,
      lng,
    };
  }

  private isExcludedInstitutionByTags(tags: Record<string, string>): boolean {
    const amenity = tags['amenity']?.toLowerCase();
    const office = tags['office']?.toLowerCase();

    if (amenity && EXCLUDED_AMENITIES.has(amenity)) {
      return true;
    }

    if (office && EXCLUDED_OFFICES.has(office)) {
      return true;
    }

    return false;
  }
}
