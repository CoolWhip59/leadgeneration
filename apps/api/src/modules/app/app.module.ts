import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CitiesModule } from '../cities/cities.module';
import { CategoriesModule } from '../categories/categories.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { JobsModule } from '../jobs/jobs.module';
import { QueueModule } from '../queue/queue.module';
import { PlacesModule } from '../places/places.module';
import { WebsiteCheckModule } from '../website-check/website-check.module';
import { JobCitiesModule } from '../job-cities/job-cities.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    CitiesModule,
    CategoriesModule,
    BusinessesModule,
    JobsModule,
    QueueModule,
    PlacesModule,
    WebsiteCheckModule,
    JobCitiesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
