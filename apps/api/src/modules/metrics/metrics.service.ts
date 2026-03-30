import { Injectable } from '@nestjs/common';
import { Prisma, WebsiteCheckStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ScopePair = { cityId: string; categoryId: string };

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getUserScopePairs(userId: string): Promise<ScopePair[]> {
    const rows = await this.prisma.jobCity.findMany({
      where: {
        deletedAt: null,
        job: {
          userId,
          deletedAt: null,
        },
      },
      select: {
        cityId: true,
        job: {
          select: {
            categoryId: true,
          },
        },
      },
    });

    const seen = new Set<string>();
    const pairs: ScopePair[] = [];

    for (const row of rows) {
      const key = `${row.cityId}:${row.job.categoryId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ cityId: row.cityId, categoryId: row.job.categoryId });
    }

    return pairs;
  }

  private buildBusinessScopeWhere(scopePairs: ScopePair[]): Prisma.BusinessWhereInput | null {
    if (scopePairs.length === 0) return null;

    return {
      AND: [
        { deletedAt: null },
        {
          OR: scopePairs.map((pair) => ({
            cityId: pair.cityId,
            categoryId: pair.categoryId,
          })),
        },
      ],
    };
  }

  async get(userId: string) {
    const scopePairs = await this.getUserScopePairs(userId);
    const businessScopeWhere = this.buildBusinessScopeWhere(scopePairs);

    const [totalJobs, runningJobs, failedJobs, completedJobs, latestJob, totalBusinesses, noWebsiteBusinesses] = await Promise.all([
      this.prisma.job.count({ where: { userId, deletedAt: null } }),
      this.prisma.job.count({ where: { userId, status: 'RUNNING', deletedAt: null } }),
      this.prisma.job.count({ where: { userId, status: 'FAILED', deletedAt: null } }),
      this.prisma.job.count({ where: { userId, status: 'COMPLETED', deletedAt: null } }),
      this.prisma.job.findFirst({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, progress: true, total: true, createdAt: true },
      }),
      businessScopeWhere ? this.prisma.business.count({ where: businessScopeWhere }) : Promise.resolve(0),
      businessScopeWhere
        ? this.prisma.business.count({
            where: {
              AND: [
                businessScopeWhere,
                {
                  websiteStatus: {
                    in: [
                      WebsiteCheckStatus.NO_WEBSITE,
                      WebsiteCheckStatus.SOCIAL_ONLY,
                      WebsiteCheckStatus.TIMEOUT,
                      WebsiteCheckStatus.HTTP_ERROR,
                    ],
                  },
                },
              ],
            },
          })
        : Promise.resolve(0),
    ]);

    return {
      jobs: {
        total: totalJobs,
        running: runningJobs,
        failed: failedJobs,
        completed: completedJobs,
      },
      businesses: {
        total: totalBusinesses,
        noWebsite: noWebsiteBusinesses,
      },
      latestJob,
    };
  }
}
