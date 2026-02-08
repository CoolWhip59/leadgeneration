import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { BusinessesService } from './businesses.service';
import { BusinessQueryDto } from './businesses.dto';

@Controller('businesses')
@UseGuards(JwtAuthGuard)
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Get()
  list(@Query() query: BusinessQueryDto) {
    return this.businesses.list(query);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="businesses.csv"')
  async export(@Query() query: BusinessQueryDto) {
    return this.businesses.exportCsv(query);
  }
}
