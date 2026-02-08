import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../queue/queue.module';
import { JobCitiesController } from './job-cities.controller';
import { JobCitiesService } from './job-cities.service';

@Module({
  imports: [AuthModule, QueueModule],
  controllers: [JobCitiesController],
  providers: [JobCitiesService],
})
export class JobCitiesModule {}
