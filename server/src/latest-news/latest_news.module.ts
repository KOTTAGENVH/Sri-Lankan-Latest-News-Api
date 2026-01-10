import { Module } from '@nestjs/common';
import { LatestNewsService } from './latest_news.service';
import { LatestNewsController } from './latest_news.controller';

@Module({
  controllers: [LatestNewsController],
  providers: [LatestNewsService],
  exports: [LatestNewsService],
})
export class LatestNewsModule {}
