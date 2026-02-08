import { Module } from '@nestjs/common';
import { PlacesService } from './places.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}
