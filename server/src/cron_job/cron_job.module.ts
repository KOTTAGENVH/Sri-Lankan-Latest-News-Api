import { Module } from '@nestjs/common';
import { CronJobService } from './cron_job.service';
import { CronJobController } from './cron_job.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { News, NewsSchema } from 'src/database/mongodb/schemas/news.schema';
import { LatestNewsModule } from 'src/latest-news/latest_news.module';
// import { EmbeddingService } from 'src/database/pinecone/embedding.service';
// import { PineconeService } from 'src/database/pinecone/pinecone.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: News.name, schema: NewsSchema }]),
    LatestNewsModule,
  ],
  controllers: [CronJobController],
  providers: [CronJobService],
})
export class CronJobModule {}
