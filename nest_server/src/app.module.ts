import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LatestNewsModule } from './latest-news/latest_news.module';
import { NotFoundFilter } from './not-found-filter';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 60, // seconds
      max: 100, // optional
      store: 'memory',
    }),
    LatestNewsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: NotFoundFilter,
    },
    AppService,
  ],
})
export class AppModule {}
