import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
export declare class JobCitiesService {
    private readonly prisma;
    private readonly queue;
    constructor(prisma: PrismaService, queue: Queue);
    private retryableError;
    retry(userId: string, jobCityId: string): Promise<{
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
    }>;
}
