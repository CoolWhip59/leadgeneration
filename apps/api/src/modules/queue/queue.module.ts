import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { LEAD_QUEUE_NAME } from './queue.constants';

@Module({
  providers: [
    {
      provide: 'REDIS_CONNECTION',
      useFactory: () =>
        new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
          maxRetriesPerRequest: null,
        }),
    },
    {
      provide: 'LEAD_QUEUE',
      useFactory: (connection: IORedis) =>
        new Queue(LEAD_QUEUE_NAME, {
          connection,
        }),
      inject: ['REDIS_CONNECTION'],
    },
  ],
  exports: ['REDIS_CONNECTION', 'LEAD_QUEUE'],
})
export class QueueModule {}
