import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './categories.dto';
export declare class CategoriesController {
    private readonly categories;
    constructor(categories: CategoriesService);
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
