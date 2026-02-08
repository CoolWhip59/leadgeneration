import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './jobs.dto';
export declare class JobsController {
    private readonly jobs;
    private readonly jwt;
    constructor(jobs: JobsService, jwt: JwtService);
    create(req: any, dto: CreateJobDto): Promise<{
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
    list(req: any): import(".prisma/client").Prisma.PrismaPromise<({
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
    get(req: any, id: string): Promise<{
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
    errors(req: any, id: string): Promise<{
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
    stream(req: any, id: string, token?: string): Observable<unknown>;
}
