import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Model } from 'mongoose';
import { News, NewsDocument } from '../database/mongodb/schemas/news.schema';
import { LatestNewsService } from '../latest-news/latest_news.service';
import { IRDItem, VulnItem } from '../latest-news/interfaces';

interface UpsertPayload {
  id: string;
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
  source: string;
  category?: string;
  publishedAt?: Date | null;
  pinned?: boolean;
}

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

  private safeDate(value?: string | null): Date | null {
    if (!value) return null;

    const rel = String(value)
      .trim()
      .match(/^(\d+)\s+(minute|hour|day|week)s?\s+ago$/i);
    if (rel) {
      const ms: Record<string, number> = {
        minute: 60_000,
        hour: 3_600_000,
        day: 86_400_000,
        week: 604_800_000,
      };
      return new Date(Date.now() - Number(rel[1]) * ms[rel[2].toLowerCase()]);
    }

    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  private async upsertNews(data: UpsertPayload) {
    try {
      const exists = await this.newsModel.exists({ id: data.id });
      if (exists) return false;
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
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to upsert news [${data.source}] ${data.id}`,
        err instanceof Error ? err.stack : String(err),
      );
      return false;
    }
  }

  private async upsertMutable(data: UpsertPayload, mutableKeys: string[]) {
    try {
      const $set: Record<string, any> = { lastSeenAt: new Date() };
      for (const k of mutableKeys) {
        const v = (data as any)[k];
        if (v !== undefined && v !== null) $set[k] = v;
      }

      const $setOnInsert: Record<string, any> = { fetchedAt: new Date() };
      for (const [k, v] of Object.entries(data)) {
        if (!(k in $set)) $setOnInsert[k] = v;
      }

      await this.newsModel.updateOne(
        { id: data.id },
        { $set, $setOnInsert },
        { upsert: true },
      );

      return true;
    } catch (err) {
      this.logger.error(
        `Failed to upsert [${data.source}] ${data.id}`,
        err instanceof Error ? err.stack : String(err),
      );
      return false;
    }
  }

  private async saveIrd(items: IRDItem[], kind: 'news' | 'content') {
    let saved = 0;
    let skipped = 0;

    try {
      for (const item of items) {
        if (!item?.source || !item?.title) {
          skipped++;
          continue;
        }

        const ok = await this.upsertNews({
          id: this.generateId(`ird_${kind}`, item.source),
          title: item.title,
          description: item.category ?? undefined,
          url: item.source,
          source: `ird_${kind}`,
          category: 'tax',
          publishedAt: this.safeDate(item.dateISO),
          pinned: true,
        });
        if (ok) saved++;
      }

      if (skipped) {
        this.logger.warn(
          `IRD ${kind}: skipped ${skipped} items missing title/url`,
        );
      }
      return saved;
    } catch (err) {
      this.logger.error(
        `IRD ${kind} save failed`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  private async saveArticles(
    items: any[],
    source: string,
    category: string,
    opts: { baseUrl?: string; dateKeys?: string[] } = {},
  ): Promise<number> {
    const dateKeys = opts.dateKeys ?? ['datetime', 'date', 'time', 'dateISO'];
    let saved = 0;
    let skipped = 0;

    for (const a of items ?? []) {
      if (!a?.source || !a?.title) {
        skipped++;
        continue;
      }

      const url =
        opts.baseUrl && !String(a.source).startsWith('http')
          ? `${opts.baseUrl}${a.source}`
          : a.source;

      const ok = await this.upsertNews({
        id: this.generateId(source, url),
        title: a.title,
        description: a.description || undefined,
        url,
        imageUrl: a.image || undefined,
        source,
        category,
        publishedAt: this.safeDate(dateKeys.map((k) => a[k]).find(Boolean)),
      });
      if (ok) saved++;
    }

    if (skipped) {
      this.logger.warn(`${source}: skipped ${skipped} items missing title/url`);
    }
    return saved;
  }

  private async saveUnNews(items: any[]): Promise<number> {
    let saved = 0;
    for (const a of items ?? []) {
      if (!a?.source || !a?.title) continue;

      const ok = await this.upsertNews({
        id: this.generateId('un_news', a.source),
        title: a.title,
        description: a.description || undefined,
        url: a.source,
        source: 'un_news',
        category: 'international',
        publishedAt: this.safeDate(a.publishedISO),
      });
      if (ok) saved++;
    }
    return saved;
  }

  private vulnTitle(v: VulnItem): string {
    if (v.title) return v.title;
    const parts = [v.vendor, v.product].filter(Boolean).join(' ');
    return parts ? `${v.id} — ${parts}` : v.id;
  }

  private async saveVulns(items: VulnItem[]) {
    let saved = 0;
    let skipped = 0;

    try {
      for (const v of items) {
        if (!v?.id || !v?.link) {
          skipped++;
          continue;
        }

        const ok = await this.upsertMutable(
          {
            id: this.generateId('cyber_vuln', v.link),
            title: this.vulnTitle(v),
            description: v.description ?? undefined,
            url: v.link,
            source: v.sources[0] ?? 'cyber',
            category: 'cybersecurity',
            publishedAt: this.safeDate(v.publishedISO),
            pinned: true,
          },
          ['title', 'description', 'publishedAt'],
        );
        if (ok) saved++;
      }

      if (skipped) {
        this.logger.warn(`Cyber: skipped ${skipped} items missing id/link`);
      }
      return saved;
    } catch (err) {
      this.logger.error(
        'Cyber save failed',
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  async callCronjobLankadeepa() {
    try {
      const result = await this.latestNewsService.latestLankadeepa(1);
      const saved = await this.saveArticles(result, 'lankadeepa', 'general');

      this.logger.log(`Lankadeepa Cron job completed (${saved} items)`);
      return { message: 'Lankadeepa Cron job completed', saved };
    } catch (err) {
      this.logger.error(
        'Lankadeepa Cron job failed',
        err instanceof Error ? err.stack : String(err),
      );

      return { message: 'Lankadeepa Cron job failed' };
    }
  }

  async callCronjobBBCSinhala() {
    try {
      const result = await this.latestNewsService.latestBBCSinhala(1);
      const saved = await this.saveArticles(
        result,
        'bbcSinhala',
        'international',
      );

      this.logger.log(`BBC Sinhala Cron job completed (${saved} items)`);
      return { message: 'BBC Sinhala Cron job completed', saved };
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
      const d: any = await this.latestNewsService.latestNewsFirstTamil();
      const items = [
        ...(d?.latest || []),
        ...(d?.breaking_latest || []),
        ...(d?.breaking || []),
        ...(d?.archive || []),
      ];
      const saved = await this.saveArticles(items, 'newsfirst_tamil', 'tamil', {
        baseUrl: 'https://tamil.newsfirst.lk',
      });

      this.logger.log(`NewsFirstTamil Cron job completed (${saved} items)`);
      return { message: 'NewsFirstTamil Cron job completed', saved };
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
      const d: any = await this.latestNewsService.latestNewsWire();
      const items = [
        ...(d?.lead_story || []),
        ...(d?.latest || []),
        ...(d?.trending || []),
        ...(d?.moreNews || []),
      ];
      const saved = await this.saveArticles(items, 'newswire', 'general');

      this.logger.log(`NewsWire Cron job completed (${saved} items)`);
      return { message: 'NewsWire Cron job completed', saved };
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
      const d: any = await this.latestNewsService.latestAdaDerana();
      const saved = await this.saveArticles(
        d?.all || [],
        'adaderana',
        'general',
        {
          baseUrl: 'https://www.adaderana.lk/',
        },
      );

      this.logger.log(`AdaDerana Cron job completed (${saved} items)`);
      return { message: 'AdaDerana Cron job completed', saved };
    } catch (err) {
      this.logger.error(
        'Adaderana Cron job failed',
        err instanceof Error ? err.stack : String(err),
      );

      return { message: 'Adaderana Cron job failed' };
    }
  }

  async callCronjobIrdNotices() {
    try {
      const result = await this.latestNewsService.latestIrdNotices(1);
      const saved = await this.saveIrd(result, 'news');

      this.logger.log(`IRD Notices Cron job completed (${saved} items)`);
      return { message: 'IRD Notices Cron job completed', saved };
    } catch (err) {
      this.logger.error(
        'IRD Notices Cron job failed',
        err instanceof Error ? err.stack : String(err),
      );

      return { message: 'IRD Notices Cron job failed' };
    }
  }

  async callCronjobIrdContent() {
    try {
      const result = await this.latestNewsService.latestIrdContent(1);
      const saved = await this.saveIrd(result, 'content');

      this.logger.log(`IRD Content Cron job completed (${saved} items)`);
      return { message: 'IRD Content Cron job completed', saved };
    } catch (err) {
      this.logger.error(
        'IRD Content Cron job failed',
        err instanceof Error ? err.stack : String(err),
      );

      return { message: 'IRD Content Cron job failed' };
    }
  }

  async callCronjobKev() {
    try {
      const result = await this.latestNewsService.latestKev(100);
      const saved = await this.saveVulns(result);

      this.logger.log(`KEV Cron job completed (${saved} items)`);
      return { message: 'KEV Cron job completed', saved };
    } catch (err) {
      this.logger.error(
        'KEV Cron job failed',
        err instanceof Error ? err.stack : String(err),
      );

      return { message: 'KEV Cron job failed' };
    }
  }

  async callCronjobEuvd(type: 'latest' | 'critical' | 'exploited' = 'latest') {
    try {
      const result = await this.latestNewsService.latestEuvd(type);
      const saved = await this.saveVulns(result);

      this.logger.log(`EUVD ${type} Cron job completed (${saved} items)`);
      return { message: `EUVD ${type} Cron job completed`, saved };
    } catch (err) {
      this.logger.error(
        `EUVD ${type} Cron job failed`,
        err instanceof Error ? err.stack : String(err),
      );
      return { message: `EUVD ${type} Cron job failed` };
    }
  }

  async callCronjobUnNews() {
    try {
      const result: any = await this.latestNewsService.latestUnNews('all');
      const saved = await this.saveUnNews(result);

      this.logger.log(`UN News Cron job completed (${saved} items)`);
      return { message: 'UN News Cron job completed', saved };
    } catch (err) {
      this.logger.error(
        'UN News Cron job failed',
        err instanceof Error ? err.stack : String(err),
      );
      return { message: 'UN News Cron job failed' };
    }
  }

  async callCronjobCyber() {
    try {
      const result = await this.latestNewsService.latestVulnFeed(100);
      const saved = await this.saveVulns(result);

      this.logger.log(`Cyber Cron job completed (${saved} items)`);
      return { message: 'Cyber Cron job completed', saved };
    } catch (err) {
      this.logger.error(
        'Cyber Cron job failed',
        err instanceof Error ? err.stack : String(err),
      );

      return { message: 'Cyber Cron job failed' };
    }
  }

  async callCronjobMongoDB() {
    try {
      const max_news = 50_000;
      const threshold = 0.7;
      const delete_ratio = 0.3;

      const totalCount = await this.newsModel.countDocuments({
        pinned: { $ne: true },
      });
      const pinnedCount = await this.newsModel.countDocuments({ pinned: true });

      const usageRatio = totalCount / max_news;

      this.logger.log(
        `MongoDB usage: ${totalCount}/${max_news} (${Math.round(
          usageRatio * 100,
        )}%)`,
      );

      if (usageRatio < threshold) {
        this.logger.log('MongoDB cleanup not required');
        return {
          status: 'ok',
          message: 'Below threshold, no cleanup needed',
          pinned: pinnedCount,
        };
      }

      const deleteCount = Math.floor(max_news * delete_ratio);

      this.logger.warn(
        `MongoDB usage exceeded threshold. Deleting ${deleteCount} oldest documents`,
      );

      const idsToDelete = await this.newsModel
        .find({ pinned: { $ne: true } }, { _id: 1 })
        .sort({ fetchedAt: 1 }) // oldest first
        .limit(deleteCount)
        .lean()
        .exec();

      const deleteIds = idsToDelete.map((d) => d._id);

      if (deleteIds.length === 0) {
        this.logger.warn('No documents found to delete');
        return { status: 'ok', deleted: 0 };
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
