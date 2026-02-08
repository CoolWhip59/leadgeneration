import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import IORedis from 'ioredis';
import { SimpleRateLimiter, withRetry } from '../common/http.util';

export type PlaceResult = {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  websiteUrl?: string;
  googleMapsUrl: string;
  rating?: number;
  lat: number;
  lng: number;
};

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);
  private readonly apiKey = process.env.GOOGLE_PLACES_API_KEY || '';
  private readonly limiter = new SimpleRateLimiter(
    Number(process.env.GOOGLE_PLACES_MIN_INTERVAL_MS || 200),
  );
  private readonly cacheTtl = Number(process.env.GOOGLE_PLACES_CACHE_TTL_SEC || 604800);

  constructor(@Inject('REDIS_CONNECTION') private readonly redis: IORedis) {}

  async searchBusinesses(city: string, category: string): Promise<PlaceResult[]> {
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
      placeId: detail.place_id,
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
}
