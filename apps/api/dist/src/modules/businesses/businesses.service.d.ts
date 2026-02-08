import { PrismaService } from '../prisma/prisma.service';
import { BusinessQueryDto } from './businesses.dto';
export declare class BusinessesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(query: BusinessQueryDto): Promise<({
        city: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            name: string;
            country: string;
        };
        category: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            name: string;
            slug: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        cityId: string;
        name: string;
        categoryId: string;
        placeId: string;
        address: string;
        phone: string | null;
        websiteUrl: string | null;
        googleMapsUrl: string;
        rating: number | null;
        lat: number;
        lng: number;
        websiteStatus: import(".prisma/client").$Enums.WebsiteCheckStatus;
        websiteCheckedAt: Date | null;
        websiteHttpStatus: number | null;
        websiteResponseMs: number | null;
    })[]>;
    exportCsv(query: BusinessQueryDto): Promise<string>;
}
