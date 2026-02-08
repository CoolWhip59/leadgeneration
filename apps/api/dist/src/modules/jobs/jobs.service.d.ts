import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './jobs.dto';
export declare class JobsService {
    private readonly prisma;
    private readonly queue;
    constructor(prisma: PrismaService, queue: Queue);
    private retryableError;
    create(userId: string, dto: CreateJobDto): Promise<{
        error: string | null;
        id: string;
        status: import(".prisma/client").$Enums.JobStatus;
        progress: number;
        total: number;
        startedAt: Date | null;
        finishedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        userId: string;
        categoryId: string;
    }>;
    list(userId: string): import(".prisma/client").Prisma.PrismaPromise<({
        category: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            name: string;
            slug: string;
        };
        jobCities: ({
            city: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                country: string;
            };
        } & {
            error: string | null;
            id: string;
            status: import(".prisma/client").$Enums.JobStatus;
            attempt: number;
            progress: number;
            total: number;
            errorCode: string | null;
            queueJobId: string | null;
            startedAt: Date | null;
            finishedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            jobId: string;
            cityId: string;
        })[];
    } & {
        error: string | null;
        id: string;
        status: import(".prisma/client").$Enums.JobStatus;
        progress: number;
        total: number;
        startedAt: Date | null;
        finishedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        userId: string;
        categoryId: string;
    })[]>;
    get(userId: string, id: string): Promise<{
        category: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            name: string;
            slug: string;
        };
        jobCities: ({
            city: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                country: string;
            };
        } & {
            error: string | null;
            id: string;
            status: import(".prisma/client").$Enums.JobStatus;
            attempt: number;
            progress: number;
            total: number;
            errorCode: string | null;
            queueJobId: string | null;
            startedAt: Date | null;
            finishedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            jobId: string;
            cityId: string;
        })[];
    } & {
        error: string | null;
        id: string;
        status: import(".prisma/client").$Enums.JobStatus;
        progress: number;
        total: number;
        startedAt: Date | null;
        finishedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        userId: string;
        categoryId: string;
    }>;
    getErrors(userId: string, id: string): Promise<{
        id: string;
        jobId: string;
        jobCityId: string;
        cityId: string;
        cityName: string;
        errorCode: string;
        message: string;
        stack: string | null;
        rawError: string | null;
        createdAt: Date;
        canViewStack: boolean;
        retryable: boolean;
    }[]>;
}
