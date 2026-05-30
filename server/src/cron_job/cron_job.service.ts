import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Model } from 'mongoose';
import { News, NewsDocument } from '../database/mongodb/schemas/news.schema';
import { LatestNewsService } from '../latest-news/latest_news.service';

@Injectable()
export class CronJobService {
  private readonly logger = new Logger(CronJobService.name);

  constructor(
    private readonly latestNewsService: LatestNewsService,
    @InjectModel(News.name)
    private readonly newsModel: Model<NewsDocument>,
  ) {}

  private generateId(source: string, url: string) {
    return createHash('sha256').update(`${source}:${url}`).digest('hex');
  }

  private safeDate(value?: string): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  private async upsertNews(data: {
    id: string;
    title: string;
    description?: string;
    url: string;
    imageUrl?: string;
    source: string;
    category?: string;
    publishedAt?: Date | null;
  }) {
    try {
      const exists = await this.newsModel.exists({ id: data.id });
      if (exists) return;
      //Uncommend if embedding server is self hosted
      // const response = await fetch('http://0.0.0.0:8000/embed/text', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     embedding_news_api_key: process.env.EMBEDDING_API_KEY!,
      //   },
      //   body: JSON.stringify({ text: data.title }),
      // });

      // if (!response.ok) {
      //   throw new Error(`Embedding API failed (${response.status})`);
      // }

      // const json = await response.json();
      await this.newsModel.updateOne(
        { id: data.id },
        {
          $setOnInsert: {
            ...data,
            // plot_embedding: json.embedding,
            fetchedAt: new Date(),
          },
        },
        { upsert: true },
      );
    } catch (err) {
      this.logger.error(
        `Failed to upsert news [${data.source}] ${data.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async saveLankadeepa(items: any[]) {
    try {
      for (const article of items) {
        if (!article?.source || !article?.title) {
          console.error('LAnka deepa ttitle cannot be scraped!!!');
          throw new Error(
            `Lankadeepa article missing required fields - source: ${article?.source ?? 'null'}, title: ${article?.title ?? 'null'}`,
          );
        }

        await this.upsertNews({
          id: this.generateId('lankadeepa', article.source),
          title: article.title,
          description: article.description,
          url: article.source,
          imageUrl: article.image,
          source: 'lankadeepa',
          category: 'general',
          publishedAt: this.safeDate(article.time),
        });
      }
    } catch (err) {
      this.logger.error(
        'Lankadeepa save failed',
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  private async saveDeshaya(items: any[]) {
    try {
      for (const article of items) {
        if (!article?.source || !article?.title) continue;

        await this.upsertNews({
          id: this.generateId('deshaya', article.source),
          title: article.title,
          description: article.description,
          url: article.source,
          source: 'deshaya',
          category: 'features',
          publishedAt: this.safeDate(article.time),
        });
      }
    } catch (err) {
      this.logger.error(
        'Deshaya save failed',
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  private async saveBBC(items: any[]) {
    try {
      for (const article of items) {
        if (!article?.source || !article?.title) continue;

        await this.upsertNews({
          id: this.generateId('bbcSinhala', article.source),
          title: article.title,
          url: article.source,
          imageUrl: article.image,
          source: 'bbcSinhala',
          category: 'international',
          publishedAt: this.safeDate(article.dateISO),
        });
      }
    } catch (err) {
      this.logger.error(
        'BBC save failed',
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  private async saveNewsWire(data: any) {
    try {
      const sections = [
        ...(data.lead_story || []),
        ...(data.latest || []),
        ...(data.trending || []),
        ...(data.moreNews || []),
      ];

      for (const article of sections) {
        if (!article?.source || !article?.title) continue;

        await this.upsertNews({
          id: this.generateId('newswire', article.source),
          title: article.title,
          description: article.description,
          url: article.source,
          imageUrl: article.image,
          source: 'newswire',
          category: 'general',
          publishedAt: this.safeDate(article.datetime || article.date),
        });
      }
    } catch (err) {
      this.logger.error(
        'Newswire save failed',
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  private async saveAdaDerana(data: any) {
    try {
      const sections = [
        ...(data.lead_story || []),
        ...(data.hot_news || []),
        ...(data.technology || []),
        ...(data.entertainment || []),
      ];

      for (const article of sections) {
        if (!article?.source || !article?.title) continue;

        const url = article.source.startsWith('http')
          ? article.source
          : `https://www.adaderana.lk/${article.source}`;

        await this.upsertNews({
          id: this.generateId('adaderana', url),
          title: article.title,
          description: article.description,
          url,
          imageUrl: article.image,
          source: 'adaderana',
          category: 'general',
          publishedAt: this.safeDate(article.date || article.time),
        });
      }
    } catch (err) {
      this.logger.error(
        'Adaderana save failed',
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  private async saveNewsFirstTamil(data: any) {
    try {
      if (!data?.latest) return;

      const sections = [
        ...(data?.latest || []),
        ...(data?.breaking_latest || []),
        ...(data?.breaking || []),
        ...(data?.archive || []),
      ];

      for (const article of sections) {
        if (!article?.source || !article?.title) continue;

        const url = article.source.startsWith('http')
          ? article.source
          : `https://www.newsfirst.lk${article.source}`;

        await this.upsertNews({
          id: this.generateId('newsfirst_tamil', url),
          title: article.title,
          description: article.description,
          url,
          imageUrl: article.image,
          source: 'newsfirst_tamil',
          category: 'tamil',
          publishedAt: this.safeDate(article.date),
        });
      }
    } catch (err) {
      this.logger.error(
        'Newsfirst tamil save failed',
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  async callCronjobLankadeepa() {
    try {
      const result = await this.latestNewsService.latestLankadeepa(1, 1);
      await this.saveLankadeepa(result);

      this.logger.log('Lankadeepa Cron job completed');
      return { message: 'Lankadeepa Cron job completed' };
    } catch (err) {
      this.logger.error(
        'Lankadeepa Cron job failed',
        err instanceof Error ? err.stack : String(err),
      );

      return { message: 'Lankadeepa Cron job failed' };
    }
  }

  async callCronjobDeshaya() {
    try {
      const result = await this.latestNewsService.latestDeshaya(1);
      await this.saveDeshaya(result);

      this.logger.log('Deshaya Cron job completed');
      return { message: 'Deshaya Cron job completed' };
    } catch (err) {
      this.logger.error(
        'Deshaya Cron job failed',
        err instanceof Error ? err.stack : String(err),
      );

      return { message: 'Deshaya Cron job failed' };
    }
  }

  async callCronjobBBCSinhala() {
    try {
      const result = await this.latestNewsService.latestBBCSinhala(1);
      await this.saveBBC(result);

      this.logger.log('BBC Sinhala Cron job completed');
      return { message: 'BBC Sinhala Cron job completed' };
    } catch (err) {
      this.logger.error(
        'BBC Cron job failed',
        err instanceof Error ? err.stack : String(err),
      );

      return { message: 'BBC Cron job failed' };
    }
  }

  async callCronjobNewsFirstTamil() {
    try {
      const result = await this.latestNewsService.latestNewsFirstTamil();
      await this.saveNewsFirstTamil(result);

      this.logger.log('NewsFirstTamil Cron job completed');
      return { message: 'NewsFirstTamil Cron job completed' };
    } catch (err) {
      this.logger.error(
        'NewsFirstTamil Cron job failed',
        err instanceof Error ? err.stack : String(err),
      );

      return { message: 'NewsFirstTamil Cron job failed' };
    }
  }

  async callCronjobNewsWire() {
    try {
      const result = await this.latestNewsService.latestNewsWire();
      await this.saveNewsWire(result);

      this.logger.log('NewsWire Cron job completed');
      return { message: 'NewsWire Cron job completed' };
    } catch (err) {
      this.logger.error(
        'Newswire Cron job failed',
        err instanceof Error ? err.stack : String(err),
      );

      return { message: 'Newswire Cron job failed' };
    }
  }

  async callCronjobAdaDerana() {
    try {
      const result = await this.latestNewsService.latestAdaDerana();
      await this.saveAdaDerana(result);

      this.logger.log('AdaDerana Cron job completed');
      return { message: 'AdaDerana Cron job completed' };
    } catch (err) {
      this.logger.error(
        'Adaderana Cron job failed',
        err instanceof Error ? err.stack : String(err),
      );

      return { message: 'Adaderana Cron job failed' };
    }
  }

  async callCronjobMongoDB() {
    try {
      const MAX_NEWS = 50_000;
      const THRESHOLD = 0.7;
      const DELETE_RATIO = 0.3;

      const totalCount = await this.newsModel.estimatedDocumentCount();

      const usageRatio = totalCount / MAX_NEWS;

      this.logger.log(
        `MongoDB usage: ${totalCount}/${MAX_NEWS} (${Math.round(
          usageRatio * 100,
        )}%)`,
      );

      if (usageRatio < THRESHOLD) {
        this.logger.log('MongoDB cleanup not required');
        return {
          status: 'ok',
          message: 'Below threshold, no cleanup needed',
        };
      }

      const deleteCount = Math.floor(MAX_NEWS * DELETE_RATIO);

      this.logger.warn(
        `MongoDB usage exceeded threshold. Deleting ${deleteCount} oldest documents`,
      );

      const idsToDelete = await this.newsModel
        .find({}, { _id: 1 })
        .sort({ fetchedAt: 1 }) // oldest first
        .limit(deleteCount)
        .lean()
        .exec();

      const deleteIds = idsToDelete.map((d) => d._id);

      if (deleteIds.length === 0) {
        this.logger.warn('No documents found to delete');
        return;
      }

      const result = await this.newsModel.deleteMany({
        _id: { $in: deleteIds },
      });

      this.logger.warn(
        `MongoDB cleanup completed. Deleted ${result.deletedCount} documents`,
      );

      return {
        status: 'cleaned',
        deleted: result.deletedCount,
      };
    } catch (err) {
      this.logger.error(
        'MongoDB cleanup cron failed',
        err instanceof Error ? err.stack : String(err),
      );

      return { status: 'error' };
    }
  }
}
