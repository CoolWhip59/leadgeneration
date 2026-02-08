import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './categories.dto';
export declare class CategoriesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        slug: string;
    }[]>;
    create(dto: CreateCategoryDto): import(".prisma/client").Prisma.Prisma__CategoryClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        slug: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
