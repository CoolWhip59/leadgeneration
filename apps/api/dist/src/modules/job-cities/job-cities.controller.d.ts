import { JobCitiesService } from './job-cities.service';
export declare class JobCitiesController {
    private readonly jobCities;
    constructor(jobCities: JobCitiesService);
    retry(req: any, id: string): Promise<{
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
