import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CitiesService } from './cities.service';
import { CreateCityDto } from './cities.dto';

@Controller('cities')
export class CitiesController {
  constructor(private readonly cities: CitiesService) {}

  @Get()
  list() {
    return this.cities.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateCityDto) {
    return this.cities.create(dto);
  }
}
