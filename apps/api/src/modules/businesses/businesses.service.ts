import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessQueryDto } from './businesses.dto';
import { WebsiteCheckStatus } from '@prisma/client';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: BusinessQueryDto) {
    const filters: any = { deletedAt: null };
    if (query.cityId) filters.cityId = query.cityId;
    if (query.categoryId) filters.categoryId = query.categoryId;
    if (query.search) {
      filters.name = { contains: query.search, mode: 'insensitive' };
    }
    if (query.noWebsite === '1' || query.noWebsite === 'true') {
      filters.websiteStatus = {
        in: [
          WebsiteCheckStatus.NO_WEBSITE,
          WebsiteCheckStatus.SOCIAL_ONLY,
          WebsiteCheckStatus.TIMEOUT,
          WebsiteCheckStatus.HTTP_ERROR,
        ],
      };
    }

    return this.prisma.business.findMany({
      where: filters,
      include: { city: true, category: true },
      orderBy: { updatedAt: 'desc' },
      take: 2000,
    });
  }

  async exportCsv(query: BusinessQueryDto) {
    const records = await this.list(query);
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
}
