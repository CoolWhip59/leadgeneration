"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PlacesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlacesService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
const ioredis_1 = require("ioredis");
const http_util_1 = require("../common/http.util");
let PlacesService = PlacesService_1 = class PlacesService {
    constructor(redis) {
        this.redis = redis;
        this.logger = new common_1.Logger(PlacesService_1.name);
        this.apiKey = process.env.GOOGLE_PLACES_API_KEY || '';
        this.limiter = new http_util_1.SimpleRateLimiter(Number(process.env.GOOGLE_PLACES_MIN_INTERVAL_MS || 200));
        this.cacheTtl = Number(process.env.GOOGLE_PLACES_CACHE_TTL_SEC || 604800);
    }
    async searchBusinesses(city, category) {
        if (!this.apiKey) {
            throw new Error('GOOGLE_PLACES_API_KEY not configured');
        }
        const cacheKey = this.buildCacheKey(city, category);
        if (this.cacheTtl > 0) {
            try {
                const cached = await this.redis.get(cacheKey);
                if (cached) {
                    return JSON.parse(cached);
                }
            }
            catch (error) {
                this.logger.warn('Redis cache read failed');
            }
        }
        const results = [];
        let pageToken;
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
            }
            catch {
                this.logger.warn('Redis cache write failed');
            }
        }
        return results;
    }
    buildCacheKey(city, category) {
        const safeCity = encodeURIComponent(city.trim().toLowerCase());
        const safeCategory = encodeURIComponent(category.trim().toLowerCase());
        return `places:${safeCity}:${safeCategory}`;
    }
    async textSearch(city, category, pageToken) {
        const query = `${category} in ${city}`;
        const params = {
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
        const response = await (0, http_util_1.withRetry)(() => axios_1.default.get('https://maps.googleapis.com/maps/api/place/textsearch/json', { params }));
        if (response.data?.status !== 'OK' && response.data?.status !== 'ZERO_RESULTS') {
            this.logger.warn(`Places text search status: ${response.data?.status}`);
        }
        return {
            places: response.data?.results || [],
            nextPageToken: response.data?.next_page_token,
        };
    }
    async getDetails(placeId) {
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
        const response = await (0, http_util_1.withRetry)(() => axios_1.default.get('https://maps.googleapis.com/maps/api/place/details/json', { params }));
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
};
exports.PlacesService = PlacesService;
exports.PlacesService = PlacesService = PlacesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('REDIS_CONNECTION')),
    __metadata("design:paramtypes", [ioredis_1.default])
], PlacesService);
//# sourceMappingURL=places.service.js.map