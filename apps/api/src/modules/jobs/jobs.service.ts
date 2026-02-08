import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './jobs.dto';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('LEAD_QUEUE') private readonly queue: Queue,
  ) {}

  private retryableError(errorCode?: string | null) {
    if (!errorCode) return false;
    const nonRetryable = new Set(['INVALID_ARGUMENT', 'AUTH_ERROR', 'FORBIDDEN', 'NOT_FOUND']);
    return !nonRetryable.has(errorCode);
  }

  async create(userId: string, dto: CreateJobDto) {
    const uniqueCityIds = Array.from(new Set(dto.cityIds));
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, deletedAt: null },
    });

    const cities = await this.prisma.city.findMany({
      where: { id: { in: uniqueCityIds }, deletedAt: null },
    });

    if (!category || cities.length !== uniqueCityIds.length) {
      throw new NotFoundException('City or category not found');
    }

    const job = await this.prisma.job.create({
      data: {
        userId,
        categoryId: category.id,
      },
    });

    for (const city of cities) {
      const jobCity = await this.prisma.jobCity.create({
        data: { jobId: job.id, cityId: city.id },
      });

      const queueJob = await this.queue.add(
        'lead-scan',
        {
          jobId: job.id,
          jobCityId: jobCity.id,
          city: city.name,
          category: category.name,
          cityId: city.id,
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
        where: { id: jobCity.id },
        data: { queueJobId: String(queueJob.id) },
      });
    }

    return job;
  }

  list(userId: string) {
    return this.prisma.job.findMany({
      where: { userId, deletedAt: null },
      include: {
        category: true,
        jobCities: {
          include: { city: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(userId: string, id: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        category: true,
        jobCities: {
          include: { city: true },
        },
      },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }

  async getErrors(userId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const job = await this.prisma.job.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const logs = await this.prisma.jobCityErrorLog.findMany({
      where: { jobId: id },
      include: {
        jobCity: {
          include: { city: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const canViewStack = user.role === 'admin';

    return logs.map((log) => ({
      id: log.id,
      jobId: log.jobId,
      jobCityId: log.jobCityId,
      cityId: log.cityId,
      cityName: log.jobCity?.city?.name,
      errorCode: log.errorCode,
      message: log.message,
      stack: canViewStack ? log.stack : null,
      rawError: canViewStack ? log.stack : null,
      createdAt: log.createdAt,
      canViewStack,
      retryable: this.retryableError(log.errorCode),
    }));
  }
}
