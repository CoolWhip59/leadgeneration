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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let BusinessesService = class BusinessesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(query) {
        const filters = { deletedAt: null };
        if (query.cityId)
            filters.cityId = query.cityId;
        if (query.categoryId)
            filters.categoryId = query.categoryId;
        if (query.search) {
            filters.name = { contains: query.search, mode: 'insensitive' };
        }
        if (query.noWebsite === '1' || query.noWebsite === 'true') {
            filters.websiteStatus = {
                in: [
                    client_1.WebsiteCheckStatus.NO_WEBSITE,
                    client_1.WebsiteCheckStatus.SOCIAL_ONLY,
                    client_1.WebsiteCheckStatus.TIMEOUT,
                    client_1.WebsiteCheckStatus.HTTP_ERROR,
                ],
            };
        }
        return this.prisma.business.findMany({
            where: filters,
            include: { city: true, category: true },
            orderBy: { updatedAt: 'desc' },
            take: 2000,
        });
    }
    async exportCsv(query) {
        const records = await this.list(query);
        const header = [
            'name',
            'address',
            'phone',
            'websiteUrl',
            'googleMapsUrl',
            'rating',
            'city',
            'category',
            'websiteStatus',
        ];
        const rows = records.map((b) => [
            b.name,
            b.address,
            b.phone || '',
            b.websiteUrl || '',
            b.googleMapsUrl,
            b.rating ?? '',
            b.city.name,
            b.category.name,
            b.websiteStatus,
        ]);
        return [header, ...rows]
            .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
    }
};
exports.BusinessesService = BusinessesService;
exports.BusinessesService = BusinessesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BusinessesService);
//# sourceMappingURL=businesses.service.js.map