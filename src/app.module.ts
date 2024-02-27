import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LatestNewsModule } from './latest-news/latest-news.module';

@Module({
  imports: [LatestNewsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
