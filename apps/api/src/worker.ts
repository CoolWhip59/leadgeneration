import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { AppModule } from './modules/app/app.module';
import { PlacesService } from './modules/places/places.service';
import { WebsiteCheckService } from './modules/website-check/website-check.service';
import { PrismaService } from './modules/prisma/prisma.service';
import { LEAD_QUEUE_NAME } from './modules/queue/queue.constants';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const places = app.get(PlacesService);
  const websiteCheck = app.get(WebsiteCheckService);

  const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker(
    LEAD_QUEUE_NAME,
    async (job) => {
      const { jobId, jobCityId, city, category, cityId, categoryId } = job.data;
      const recheckDays = Number(process.env.WEBSITE_RECHECK_DAYS || 30);
      const recheckMs = recheckDays * 24 * 60 * 60 * 1000;

      await prisma.jobCity.update({
        where: { id: jobCityId },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      await prisma.job.updateMany({
        where: { id: jobId, status: 'QUEUED' },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      const results = await places.searchBusinesses(city, category);

      await prisma.$transaction([
        prisma.jobCity.update({
          where: { id: jobCityId },
          data: { total: results.length },
        }),
        prisma.job.update({
          where: { id: jobId },
          data: { total: { increment: results.length } },
        }),
      ]);

      let processed = 0;
      let lastReported = 0;

      for (const place of results) {
        const existing = await prisma.business.findUnique({ where: { placeId: place.placeId } });

        const business = await prisma.business.upsert({
          where: { placeId: place.placeId },
          update: {
            name: place.name,
            address: place.address,
            phone: place.phone,
            websiteUrl: place.websiteUrl,
            googleMapsUrl: place.googleMapsUrl,
            rating: place.rating,
            lat: place.lat,
            lng: place.lng,
            cityId,
            categoryId,
            deletedAt: null,
          },
          create: {
            placeId: place.placeId,
            name: place.name,
            address: place.address,
            phone: place.phone,
            websiteUrl: place.websiteUrl,
            googleMapsUrl: place.googleMapsUrl,
            rating: place.rating,
            lat: place.lat,
            lng: place.lng,
            cityId,
            categoryId,
          },
        });

        const shouldCheck =
          !business.websiteCheckedAt ||
          Date.now() - business.websiteCheckedAt.getTime() > recheckMs;

        if (shouldCheck) {
          const check = await websiteCheck.checkWebsite(place.websiteUrl);

          await prisma.websiteCheck.create({
            data: {
              businessId: business.id,
              status: check.status,
              httpStatus: check.httpStatus,
              responseMs: check.responseMs,
              checkedAt: new Date(),
            },
          });

          await prisma.business.update({
            where: { id: business.id },
            data: {
              websiteStatus: check.status,
              websiteCheckedAt: new Date(),
              websiteHttpStatus: check.httpStatus,
              websiteResponseMs: check.responseMs,
            },
          });
        } else if (!existing) {
          await prisma.business.update({
            where: { id: business.id },
            data: {
              websiteStatus: business.websiteStatus,
            },
          });
        }

        processed += 1;
        if (processed % 10 === 0 || processed === results.length) {
          const delta = processed - lastReported;
          lastReported = processed;

          await prisma.$transaction([
            prisma.jobCity.update({
              where: { id: jobCityId },
              data: { progress: processed },
            }),
            prisma.job.update({
              where: { id: jobId },
              data: { progress: { increment: delta } },
            }),
          ]);
        }
      }

      await prisma.jobCity.update({
        where: { id: jobCityId },
        data: {
          status: 'COMPLETED',
          progress: processed,
          finishedAt: new Date(),
        },
      });

      const remaining = await prisma.jobCity.count({
        where: { jobId, status: { in: ['QUEUED', 'RUNNING'] } },
      });

      if (remaining === 0) {
        const failed = await prisma.jobCity.count({
          where: { jobId, status: 'FAILED' },
        });

        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: failed > 0 ? 'FAILED' : 'COMPLETED',
            finishedAt: new Date(),
          },
        });
      }

      return { processed };
    },
    {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY || 3),
    },
  );

  worker.on('failed', async (job, error) => {
    if (!job) return;

    await prisma.jobCity.update({
      where: { id: job.data.jobCityId },
      data: {
        status: 'FAILED',
        errorCode: error?.name || 'WORKER_ERROR',
        error: error?.message || 'Unknown error',
        finishedAt: new Date(),
      },
    });

    await prisma.jobCityErrorLog.create({
      data: {
        jobId: job.data.jobId,
        jobCityId: job.data.jobCityId,
        cityId: job.data.cityId,
        errorCode: error?.name || 'WORKER_ERROR',
        message: error?.message || 'Unknown error',
        stack: error?.stack || null,
      },
    });

    const remaining = await prisma.jobCity.count({
      where: { jobId: job.data.jobId, status: { in: ['QUEUED', 'RUNNING'] } },
    });

    if (remaining === 0) {
      await prisma.job.update({
        where: { id: job.data.jobId },
        data: {
          status: 'FAILED',
          error: error?.message || 'Unknown error',
          finishedAt: new Date(),
        },
      });
    }
  });

  process.on('SIGTERM', async () => {
    await worker.close();
    await connection.quit();
    await app.close();
  });
}

bootstrap();
