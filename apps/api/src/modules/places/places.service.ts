import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { SimpleRateLimiter, sleep, withRetry } from '../common/http.util';
import { OsmOverpassProvider } from './providers/osm-overpass.provider';
import { PlaceResult } from './providers/types';

@Injectable()
export class PlacesService {
  private readonly allBusinessesSlugs = new Set(['tum-isletmeler']);
  private readonly excludedInstitutionKeywords = [
    'cami',
    'camii',
    'mescit',
    'okul',
    'ilkokul',
    'ortaokul',
    'lise',
    'universite',
    'fakulte',
    'belediye',
    'kaymakamlik',
    'valilik',
    'devlet dairesi',
    'vergi dairesi',
    'nufus mudurlugu',
    'emniyet',
    'jandarma',
  ];
  private readonly logger = new Logger(PlacesService.name);
  private readonly apiKey = process.env.GOOGLE_PLACES_API_KEY || '';
  private readonly limiter = new SimpleRateLimiter(
    Number(process.env.GOOGLE_PLACES_MIN_INTERVAL_MS || 200),
  );
  private readonly cacheTtl = Number(process.env.GOOGLE_PLACES_CACHE_TTL_SEC || 604800);
  private readonly overpassCacheTtl = Number(process.env.OVERPASS_CACHE_TTL_SEC || 604800);
  private readonly nominatimEndpoint =
    process.env.NOMINATIM_ENDPOINT || 'https://nominatim.openstreetmap.org/search';
  private readonly nominatimLimiter = new SimpleRateLimiter(
    Number(process.env.NOMINATIM_MIN_INTERVAL_MS || 1000),
  );
  private readonly provider = (process.env.PLACES_PROVIDER || 'osm').toLowerCase();
  private readonly overpass = new OsmOverpassProvider();

  constructor(
    @Inject('REDIS_CONNECTION') private readonly redis: IORedis,
    private readonly prisma: PrismaService,
  ) {}

  async searchBusinesses(cityId: string, categoryId: string): Promise<PlaceResult[]> {
    const city = await this.prisma.city.findFirst({ where: { id: cityId, deletedAt: null } });
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, deletedAt: null },
    });

    if (!city || !category) {
      throw new Error('City or category not found');
    }

    const isAllBusinessesCategory = this.allBusinessesSlugs.has(category.slug);

    if (this.provider === 'google') {
      const googleResults = await this.searchGoogle(
        city.name,
        isAllBusinessesCategory ? 'isletmeler' : category.name,
      );
      return this.excludeInstitutionalPlaces(googleResults);
    }

    const bbox = await this.ensureCityBbox(city.id, city.name, city);
    const cacheKey = `overpass:${city.id}:${category.id}`;

    if (this.overpassCacheTtl > 0) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return this.excludeInstitutionalPlaces(JSON.parse(cached) as PlaceResult[]);
      }
    }

    const results = await this.overpass.search(
      { id: city.id, name: city.name, bbox },
      { name: category.name, slug: category.slug },
    );

    const filteredResults = this.excludeInstitutionalPlaces(results);

    if (this.overpassCacheTtl > 0) {
      await this.redis.setex(cacheKey, this.overpassCacheTtl, JSON.stringify(filteredResults));
    }

    return filteredResults;
  }

  private async ensureCityBbox(
    cityId: string,
    cityName: string,
    city: {
      bboxSouth: number | null;
      bboxWest: number | null;
      bboxNorth: number | null;
      bboxEast: number | null;
    },
  ): Promise<[number, number, number, number]> {
    if (
      city.bboxSouth !== null &&
      city.bboxWest !== null &&
      city.bboxNorth !== null &&
      city.bboxEast !== null
    ) {
      return [city.bboxSouth, city.bboxWest, city.bboxNorth, city.bboxEast];
    }

    const [south, west, north, east] = await this.fetchCityBbox(cityName);

    await this.prisma.city.update({
      where: { id: cityId },
      data: {
        bboxSouth: south,
        bboxWest: west,
        bboxNorth: north,
        bboxEast: east,
      },
    });

    return [south, west, north, east];
  }

  private async fetchCityBbox(cityName: string): Promise<[number, number, number, number]> {
    const params = new URLSearchParams({
      format: 'json',
      limit: '1',
      countrycodes: 'tr',
      q: cityName,
    });

    const maxAttempts = 3;
    const backoffMs = [500, 1000, 2000];

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await this.nominatimLimiter.wait();

      const response = await fetch(`${this.nominatimEndpoint}?${params.toString()}`, {
        headers: {
          'User-Agent': 'isletme-leads/1.0 (admin@local.dev)',
          'Accept-Language': 'tr',
        },
      });

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < maxAttempts) {
          await sleep(backoffMs[attempt - 1]);
          continue;
        }
        throw new Error(`Nominatim error ${response.status}`);
      }

      const data = (await response.json()) as Array<{
        boundingbox: [string, string, string, string];
      }>;

      if (!data?.length || !data[0]?.boundingbox) {
        throw new Error('Nominatim bbox not found');
      }

      const [south, north, west, east] = data[0].boundingbox.map((v) => Number(v));
      return [south, west, north, east];
    }

    throw new Error('Nominatim bbox not found');
  }

  private async searchGoogle(city: string, category: string): Promise<PlaceResult[]> {
    if (!this.apiKey) {
      throw new Error('GOOGLE_PLACES_API_KEY not configured');
    }

    const cacheKey = this.buildCacheKey(city, category);
    if (this.cacheTtl > 0) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached) as PlaceResult[];
        }
      } catch (error) {
        this.logger.warn('Redis cache read failed');
      }
    }

    const results: PlaceResult[] = [];
    let pageToken: string | undefined;

    for (let page = 0; page < 3; page += 1) {
      const { places, nextPageToken } = await this.textSearch(city, category, pageToken);
      for (const place of places) {
        const details = await this.getDetails(place.place_id);
        if (details) {
          results.push(details);
        }
      }

      if (!nextPageToken) {
        break;
      }
      pageToken = nextPageToken;
    }

    if (this.cacheTtl > 0) {
      try {
        await this.redis.setex(cacheKey, this.cacheTtl, JSON.stringify(results));
      } catch {
        this.logger.warn('Redis cache write failed');
      }
    }

    return results;
  }

  private buildCacheKey(city: string, category: string) {
    const safeCity = encodeURIComponent(city.trim().toLowerCase());
    const safeCategory = encodeURIComponent(category.trim().toLowerCase());
    return `places:${safeCity}:${safeCategory}`;
  }

  private async textSearch(city: string, category: string, pageToken?: string) {
    const query = `${category} in ${city}`;
    const params: Record<string, string> = {
      key: this.apiKey,
      query,
    };
    if (pageToken) {
      params.pagetoken = pageToken;
    }

    if (pageToken) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    await this.limiter.wait();

    const response = await withRetry(() =>
      axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', { params }),
    );

    if (response.data?.status !== 'OK' && response.data?.status !== 'ZERO_RESULTS') {
      this.logger.warn(`Places text search status: ${response.data?.status}`);
    }

    return {
      places: response.data?.results || [],
      nextPageToken: response.data?.next_page_token,
    };
  }

  private async getDetails(placeId: string): Promise<PlaceResult | null> {
    const params = {
      key: this.apiKey,
      place_id: placeId,
      fields: [
        'place_id',
        'name',
        'formatted_address',
        'formatted_phone_number',
        'website',
        'url',
        'rating',
        'geometry',
      ].join(','),
    };

    await this.limiter.wait();

    const response = await withRetry(() =>
      axios.get('https://maps.googleapis.com/maps/api/place/details/json', { params }),
    );

    const detail = response.data?.result;
    if (!detail) {
      return null;
    }

    const lat = detail.geometry?.location?.lat;
    const lng = detail.geometry?.location?.lng;
    if (lat === undefined || lng === undefined) {
      return null;
    }

    return {
      externalId: `google:place:${detail.place_id}`,
      source: 'google',
      name: detail.name,
      address: detail.formatted_address,
      phone: detail.formatted_phone_number,
      websiteUrl: detail.website,
      googleMapsUrl: detail.url,
      rating: detail.rating,
      lat,
      lng,
    };
  }

  private excludeInstitutionalPlaces(results: PlaceResult[]): PlaceResult[] {
    return results.filter((place) => !this.isInstitutionalPlace(place));
  }

  private isInstitutionalPlace(place: PlaceResult): boolean {
    const haystack = this.normalizeForKeywordMatch(`${place.name} ${place.address || ''}`);
    return this.excludedInstitutionKeywords.some((keyword) => haystack.includes(keyword));
  }

  private normalizeForKeywordMatch(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
