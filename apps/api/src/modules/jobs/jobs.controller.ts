import { Body, Controller, Get, Param, Post, Query, Req, Sse, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './jobs.dto';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService, private readonly jwt: JwtService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateJobDto) {
    return this.jobs.create(req.user.sub, dto);
  }

  @Get()
  list(@Req() req: any) {
    return this.jobs.list(req.user.sub);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.jobs.get(req.user.sub, id);
  }

  @Get(':id/errors')
  errors(@Req() req: any, @Param('id') id: string) {
    return this.jobs.getErrors(req.user.sub, id);
  }

  @Sse(':id/stream')
  stream(@Req() req: any, @Param('id') id: string, @Query('token') token?: string) {
    const authHeader = req.headers['authorization'] as string | undefined;
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const finalToken = token || bearer;

    if (!finalToken) {
      throw new UnauthorizedException('Missing token');
    }

    let payload: any;
    try {
      payload = this.jwt.verify(finalToken, { secret: process.env.JWT_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    return new Observable((subscriber) => {
      let closed = false;
      let lastStatus: string | null = null;
      const sentCityErrors = new Set<string>();

      const poll = async () => {
        if (closed) return;
        try {
          const data = await this.jobs.get(payload.sub, id);
          subscriber.next({ data });

          for (const jc of data.jobCities) {
            if (jc.status === 'FAILED' && jc.errorCode && !sentCityErrors.has(jc.id)) {
              sentCityErrors.add(jc.id);
              subscriber.next({
                event: 'city_error',
                data: {
                  jobCityId: jc.id,
                  city: jc.city?.name,
                  cityName: jc.city?.name,
                  errorCode: jc.errorCode,
                  error: jc.error,
                },
              });
            }
          }

          if (data.status !== lastStatus && (data.status === 'COMPLETED' || data.status === 'FAILED')) {
            lastStatus = data.status;
            subscriber.next({
              event: data.status === 'COMPLETED' ? 'completed' : 'failed',
              data: {
                status: data.status,
                error: data.error || null,
              },
            });
            clearInterval(intervalId);
            subscriber.complete();
            closed = true;
          }
        } catch (error) {
          subscriber.error(error);
        }
      };

      poll();
      const intervalId = setInterval(poll, 2000);

      req.on('close', () => {
        closed = true;
        clearInterval(intervalId);
        subscriber.complete();
      });
    });
  }
}
