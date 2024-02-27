import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LatestNewsModule } from './latest-news/latest-news.module';
import { NotFoundFilter } from './not-found-filter';
import { APP_FILTER } from '@nestjs/core';

@Module({
  imports: [LatestNewsModule],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: NotFoundFilter,
    },
    AppService,
  ],
})
export class AppModule {}
