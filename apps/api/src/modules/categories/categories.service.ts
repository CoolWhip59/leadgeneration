import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './categories.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  create(dto: CreateCategoryDto) {
    return this.prisma.category.upsert({
      where: { slug: dto.slug },
      update: { name: dto.name, deletedAt: null },
      create: { name: dto.name, slug: dto.slug },
    });
  }
}
