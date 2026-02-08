import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { JobCitiesService } from './job-cities.service';

@Controller('job-cities')
@UseGuards(JwtAuthGuard)
export class JobCitiesController {
  constructor(private readonly jobCities: JobCitiesService) {}

  @Post(':id/retry')
  retry(@Req() req: any, @Param('id') id: string) {
    return this.jobCities.retry(req.user.sub, id);
  }
}
