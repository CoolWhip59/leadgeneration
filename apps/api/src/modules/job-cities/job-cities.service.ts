import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobCitiesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('LEAD_QUEUE') private readonly queue: Queue,
  ) {}

  private retryableError(errorCode?: string | null) {
    if (!errorCode) return false;
    const nonRetryable = new Set(['INVALID_ARGUMENT', 'AUTH_ERROR', 'FORBIDDEN', 'NOT_FOUND']);
    return !nonRetryable.has(errorCode);
  }

  async retry(userId: string, jobCityId: string) {
    const jobCity = await this.prisma.jobCity.findFirst({
      where: { id: jobCityId, deletedAt: null },
      include: {
        job: true,
        city: true,
      },
    });

    if (!jobCity || jobCity.job.userId !== userId) {
      throw new NotFoundException('Job city not found');
    }

    const latestError = await this.prisma.jobCityErrorLog.findFirst({
      where: { jobCityId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestError || !this.retryableError(latestError.errorCode)) {
      throw new BadRequestException('Job city is not retryable');
    }

    const category = await this.prisma.category.findFirst({
      where: { id: jobCity.job.categoryId, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const maxAttempt = await this.prisma.jobCity.aggregate({
      where: { jobId: jobCity.jobId, cityId: jobCity.cityId },
      _max: { attempt: true },
    });

    const nextAttempt = (maxAttempt._max.attempt || 1) + 1;

    const newJobCity = await this.prisma.jobCity.create({
      data: {
        jobId: jobCity.jobId,
        cityId: jobCity.cityId,
        attempt: nextAttempt,
      },
    });

    const queueJob = await this.queue.add(
      'lead-scan',
      {
        jobId: jobCity.jobId,
        jobCityId: newJobCity.id,
        city: jobCity.city.name,
        category: category.name,
        cityId: jobCity.cityId,
        categoryId: category.id,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    await this.prisma.jobCity.update({
      where: { id: newJobCity.id },
      data: { queueJobId: String(queueJob.id) },
    });

    await this.prisma.job.update({
      where: { id: jobCity.jobId },
      data: {
        status: 'RUNNING',
        error: null,
        finishedAt: null,
        startedAt: jobCity.job.startedAt ?? new Date(),
      },
    });

    return newJobCity;
  }
}
