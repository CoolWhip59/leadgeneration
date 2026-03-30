import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WebsiteCheckStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessQueryDto } from './businesses.dto';

type ScopePair = { cityId: string; categoryId: string };

@Injectable()
export class BusinessesService {
  private readonly excludedInstitutionKeywords = [
    'cami',
    'camii',
    'mescit',
    'okul',
    'ilkokul',
    'ortaokul',
    'lise',
    'universite',
    'fakulte',
    'belediye',
    'kaymakamlik',
    'valilik',
    'devlet dairesi',
    'vergi dairesi',
    'nufus mudurlugu',
    'emniyet',
    'jandarma',
  ];

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

  private buildWhere(scopePairs: ScopePair[], query: BusinessQueryDto): Prisma.BusinessWhereInput {
    const and: Prisma.BusinessWhereInput[] = [
      { deletedAt: null },
      {
        OR: scopePairs.map((pair) => ({
          cityId: pair.cityId,
          categoryId: pair.categoryId,
        })),
      },
    ];

    if (query.cityId) {
      and.push({ cityId: query.cityId });
    }

    if (query.categoryId) {
      and.push({ categoryId: query.categoryId });
    }

    if (query.district) {
      and.push({ address: { contains: query.district, mode: 'insensitive' } });
    }

    if (query.search) {
      and.push({ name: { contains: query.search, mode: 'insensitive' } });
    }

    if (query.noWebsite === '1' || query.noWebsite === 'true') {
      and.push({
        websiteStatus: {
          in: [
            WebsiteCheckStatus.NO_WEBSITE,
            WebsiteCheckStatus.SOCIAL_ONLY,
            WebsiteCheckStatus.TIMEOUT,
            WebsiteCheckStatus.HTTP_ERROR,
          ],
        },
      });
    }

    if (query.hasPhone === '1' || query.hasPhone === 'true') {
      and.push({
        NOT: [{ phone: null }, { phone: '' }],
      });
    }

    if (query.hasPhone === '0' || query.hasPhone === 'false') {
      and.push({
        OR: [{ phone: null }, { phone: '' }],
      });
    }

    and.push({
      NOT: {
        OR: this.excludedInstitutionKeywords.flatMap((keyword) => [
          { name: { contains: keyword, mode: 'insensitive' } },
          { address: { contains: keyword, mode: 'insensitive' } },
        ]),
      },
    });

    return { AND: and };
  }

  async list(userId: string, query: BusinessQueryDto) {
    const scopePairs = await this.getUserScopePairs(userId);
    if (scopePairs.length === 0) return [];

    const where = this.buildWhere(scopePairs, query);

    return this.prisma.business.findMany({
      where,
      include: { city: true, category: true },
      orderBy: { updatedAt: 'desc' },
      take: 2000,
    });
  }

  async exportCsv(userId: string, query: BusinessQueryDto) {
    const records = await this.list(userId, query);
    const header = [
      'name',
      'address',
      'phone',
      'websiteUrl',
      'googleMapsUrl',
      'rating',
      'city',
      'category',
      'websiteStatus',
    ];

    const rows = records.map((b) => [
      b.name,
      b.address,
      b.phone || '',
      b.websiteUrl || '',
      b.googleMapsUrl,
      b.rating ?? '',
      b.city.name,
      b.category.name,
      b.websiteStatus,
    ]);

    return [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  async remove(userId: string, businessId: string) {
    const scopePairs = await this.getUserScopePairs(userId);
    if (scopePairs.length === 0) {
      throw new NotFoundException('Business not found');
    }

    const business = await this.prisma.business.findFirst({
      where: {
        id: businessId,
        deletedAt: null,
        OR: scopePairs.map((pair) => ({
          cityId: pair.cityId,
          categoryId: pair.categoryId,
        })),
      },
      select: { id: true },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    await this.prisma.business.update({
      where: { id: businessId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
