import { PrismaService } from '../prisma/prisma.service';
import { CreateCityDto } from './cities.dto';
export declare class CitiesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        country: string;
    }[]>;
    create(dto: CreateCityDto): import(".prisma/client").Prisma.Prisma__CityClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        country: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
