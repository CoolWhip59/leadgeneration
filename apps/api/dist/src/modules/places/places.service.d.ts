import IORedis from 'ioredis';
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
export declare class PlacesService {
    private readonly redis;
    private readonly logger;
    private readonly apiKey;
    private readonly limiter;
    private readonly cacheTtl;
    constructor(redis: IORedis);
    searchBusinesses(city: string, category: string): Promise<PlaceResult[]>;
    private buildCacheKey;
    private textSearch;
    private getDetails;
}
