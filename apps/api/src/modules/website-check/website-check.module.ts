import { Module } from '@nestjs/common';
import { WebsiteCheckService } from './website-check.service';

@Module({
  providers: [WebsiteCheckService],
  exports: [WebsiteCheckService],
})
export class WebsiteCheckModule {}
