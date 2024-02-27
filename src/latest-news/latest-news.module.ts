import { Module } from '@nestjs/common';
import { LatestNewsService } from './latest-news.service';
import { LatestNewsController } from './latest-news.controller';

@Module({
  controllers: [LatestNewsController],
  providers: [LatestNewsService],
})
export class LatestNewsModule {}
