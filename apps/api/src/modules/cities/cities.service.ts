import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCityDto } from './cities.dto';

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.city.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  create(dto: CreateCityDto) {
    return this.prisma.city.upsert({
      where: { name_country: { name: dto.name, country: dto.country } },
      update: { deletedAt: null },
      create: { name: dto.name, country: dto.country },
    });
  }
}
