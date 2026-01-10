import { Module } from '@nestjs/common';
import { HistoryService } from './history.service';
import { HistoryResolver } from './history.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import { News, NewsSchema } from '../database/mongodb/schemas/news.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: News.name, schema: NewsSchema }]),
  ],
  providers: [HistoryResolver, HistoryService],
})
export class HistoryModule {}
