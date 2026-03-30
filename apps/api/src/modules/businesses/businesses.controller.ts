import { Controller, Delete, Get, Header, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { BusinessesService } from './businesses.service';
import { BusinessQueryDto } from './businesses.dto';

@Controller('businesses')
@UseGuards(JwtAuthGuard)
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Get()
  list(@Req() req: any, @Query() query: BusinessQueryDto) {
    return this.businesses.list(req.user.sub, query);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="businesses.csv"')
  async export(@Req() req: any, @Query() query: BusinessQueryDto) {
    return this.businesses.exportCsv(req.user.sub, query);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.businesses.remove(req.user.sub, id);
  }
}
