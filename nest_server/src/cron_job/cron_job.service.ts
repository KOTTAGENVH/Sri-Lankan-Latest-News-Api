import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Model } from 'mongoose';
import { News, NewsDocument } from 'src/database/mongodb/schemas/news.schema';
import { LatestNewsService } from 'src/latest-news/latest_news.service';

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
    await this.newsModel.updateOne(
      { id: data.id },
      {
        $setOnInsert: {
          ...data,
          fetchedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }

  private async saveLankadeepa(items: any[]) {
    for (const item of items) {
      const article =
        item.article_lead || item.article_list || item.article_trending;

      if (!article?.source || !article?.title) continue;

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
  }

  private async saveDeshaya(items: any[]) {
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
  }

  private async saveBBC(items: any[]) {
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
  }

  private async saveNewsWire(data: any) {
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
  }

  private async saveAdaDerana(data: any) {
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
  }

  private async saveNewsFirstTamil(data: any) {
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
  }

  async callCronjobLankadeepa() {
    const result = await this.latestNewsService.latestLankadeepa(1, 1);
    await this.saveLankadeepa(result);

    this.logger.log('Lankadeepa Cron job completed');
    return { message: 'Lankadeepa Cron job completed' };
  }

  async callCronjobDeshaya() {
    const result = await this.latestNewsService.latestDeshaya(1);
    await this.saveDeshaya(result);

    this.logger.log('Deshaya Cron job completed');
    return { message: 'Deshaya Cron job completed' };
  }

  async callCronjobBBCSinhala() {
    const result = await this.latestNewsService.latestBBCSinhala(1);
    await this.saveBBC(result);

    this.logger.log('BBC Sinhala Cron job completed');
    return { message: 'BBC Sinhala Cron job completed' };
  }

  async callCronjobNewsFirstTamil() {
    const result = await this.latestNewsService.latestNewsFirstTamil();
    await this.saveNewsFirstTamil(result);

    this.logger.log('NewsFirstTamil Cron job completed');
    return { message: 'NewsFirstTamil Cron job completed' };
  }

  async callCronjobNewsWire() {
    const result = await this.latestNewsService.latestNewsWire();
    await this.saveNewsWire(result);

    this.logger.log('NewsWire Cron job completed');
    return { message: 'NewsWire Cron job completed' };
  }

  async callCronjobAdaDerana() {
    const result = await this.latestNewsService.latestAdaDerana();
    await this.saveAdaDerana(result);

    this.logger.log('AdaDerana Cron job completed');
    return { message: 'AdaDerana Cron job completed' };
  }

  async callCronjobMongoDB() {
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
  }
}
