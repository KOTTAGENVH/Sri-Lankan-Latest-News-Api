import { Inject, Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { safeUrl, cleanField, cleanText } from '../helper/fieldCleaner';
import { clampPage, clampSection } from '../helper/pagination';

import {
  BBCSinhalaArticle,
  DeshayaArticle,
  LankadeepaArticle,
} from './interfaces';

@Injectable()
export class LatestNewsService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  //Helper
  private async fetchWithTimeout(
    url: string,
    timeout = 8000,
    asArrayBuffer = false,
    maxBytes = 5_000_000,
  ): Promise<string | ArrayBuffer> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,si;q=0.8',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`403 body for ${url}:`, body.slice(0, 800));
        console.error(
          'Response headers:',
          Object.fromEntries(response.headers),
        );
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const declared = Number(response.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > maxBytes) {
        throw new Error(`Response too large: ${declared} bytes`);
      }

      const buf = await this.readWithLimit(response, maxBytes);
      if (asArrayBuffer) return buf as ArrayBuffer;
      const contentType = response.headers.get('content-type') ?? '';
      const charset = contentType.match(/charset=([^\s;]+)/i)?.[1] ?? 'utf-8';

      try {
        return new TextDecoder(charset).decode(buf);
      } catch {
        return new TextDecoder('utf-8').decode(buf);
      }
    } finally {
      clearTimeout(id);
    }
  }

  private async readWithLimit(
    response: Response,
    maxBytes: number,
  ): Promise<ArrayBuffer> {
    const reader = response.body?.getReader();
    if (!reader) {
      const ab = await response.arrayBuffer();
      if (ab.byteLength > maxBytes) throw new Error('Response too large');
      return ab;
    }

    const chunks: Uint8Array[] = [];
    let total = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('Response exceeded max size');
      }
      chunks.push(value);
    }

    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.byteLength;
    }
    return out.buffer as ArrayBuffer;
  }

  async latestLankadeepa(
    page: number,
    section?: number,
  ): Promise<LankadeepaArticle[]> {
    try {
      const safePage = clampPage(page);
      const safeSection = clampSection(section);

      const key = `latest-news:lankadeepa:${safePage}:${safeSection ?? ''}`;
      const cached = await this.cache.get<LankadeepaArticle[]>(key);
      if (cached) {
        return cached;
      }

      const SITE = 'https://www.lankadeepa.lk';
      const url = safeSection
        ? `${SITE}/latest_news/${safePage}/${safeSection}`
        : `${SITE}/latest_news/${safePage}`;

      const html = (await this.fetchWithTimeout(url)) as string;
      const $ = cheerio.load(html);

      const articles_lead = $(
        'section.category-page div.row article.cat-lead-story',
      );
      const articles_list = $(
        'section.category-page div.cat-list article.cat-list-item',
      );

      const articles_trending = $('section.middle-east-block article');

      if (
        articles_lead.length === 0 &&
        articles_list.length === 0 &&
        articles_trending.length === 0
      ) {
        return [];
      }

      const result: LankadeepaArticle[] = [];

      articles_lead.each((_, article) => {
        const el = $(article);
        result.push({
          source: safeUrl(el.find('a').attr('href'), SITE),
          image: safeUrl(
            el.find('img').attr('src') || el.find('img').attr('data-src'),
            SITE,
          ),
          title: cleanField(el.find('h2.cat-lead-title').text(), 300),
          description: cleanField(el.find('p.cat-lead-teaser').text(), 1000),
          time: cleanField(el.find('.story-meta span').text(), 100),
        });
      });

      articles_list.each((_, article) => {
        const el = $(article);

        result.push({
          source: safeUrl(el.find('a').attr('href'), SITE),
          image: safeUrl(
            el.find('img').attr('src') || el.find('img').attr('data-src'),
            SITE,
          ),
          title: cleanField(el.find('h3.cat-item-title').text(), 300),
          description: cleanField(el.find('p.cat-item-teaser').text(), 1000),
          time: cleanField(el.find('.story-meta span').text(), 100),
        });
      });

      articles_trending.each((_, article) => {
        const el = $(article);

        result.push({
          source: safeUrl(el.find('a').attr('href'), SITE),
          image: safeUrl(
            el.find('img').attr('src') || el.find('img').attr('data-src'),
            SITE,
          ),
          title: cleanField(
            el.find('h3.me-feature-title').text() ||
              el.find('h4.me-item-title').text(),
            300,
          ),
          description: cleanField(el.find('p.me-feature-teaser').text(), 1000),
          time: cleanField(el.find('.story-meta span').text(), 100),
        });
      });

      if (result.length === 0 || !result) {
        return [];
      }
      await this.cache.set(key, result, 60_000); // 60 seconds
      return result;
    } catch (error) {
      console.error('latestLankadeepa error:', error);
      return [];
    }
  }

  async latestDeshaya(page: number): Promise<DeshayaArticle[]> {
    try {
      const safePage = clampPage(page);
      const key = `latest-news:deshaya:${safePage}`;
      const cached = await this.cache.get<DeshayaArticle[]>(key);
      if (cached) {
        return cached;
      }

      const SITE = 'https://www.deshaya.lk';
      const html = (await this.fetchWithTimeout(
        `${SITE}/43/features/${safePage}`,
      )) as string;
      const $ = cheerio.load(html);

      // Arrays to store extracted data
      const titles: string[] = [];
      const sources: (string | null)[] = [];
      const descriptions: string[] = [];
      const times: string[] = [];

      $('.sec-1-ite-tit').each((_, element) => {
        const a = $(element).find('a');
        titles.push(cleanField(a.text(), 300));
        sources.push(safeUrl(a.attr('href'), SITE));
      });

      $('.sec-1-ite-tex').each((_, element) => {
        descriptions.push(cleanField($(element).text(), 1000));
      });

      $('.sec-1-ite-com').each((_, element) => {
        times.push(cleanField($(element).text(), 100));
      });

      if (
        titles.length === sources.length &&
        titles.length === descriptions.length &&
        titles.length === times.length
      ) {
        const result: DeshayaArticle[] = titles.map((title, index) => ({
          title,
          description: descriptions[index],
          source: sources[index],
          time: times[index],
        }));
        await this.cache.set(key, result, 60_000); // 60 seconds
        return result;
      }
      console.warn('Deshaya: extracted column lengths did not match');
      return [];
    } catch (error) {
      console.error('latestDeshaya error:', error);
      throw error;
    }
  }

  async latestBBCSinhala(page: number): Promise<BBCSinhalaArticle[]> {
    try {
      const safePage = clampPage(page);
      const key = `latest-news:bbcSinhala:${safePage}`;
      const cached = await this.cache.get<BBCSinhalaArticle[]>(key);
      if (cached) {
        return cached;
      }

      const BBC = 'https://www.bbc.com';
      const html = (await this.fetchWithTimeout(
        `${BBC}/sinhala/topics/cg7267dz901t?page=${safePage}`,
      )) as string;
      const $ = cheerio.load(html);

      const nextDataRaw = $('#__NEXT_DATA__').html();
      if (!nextDataRaw) {
        console.warn('BBC Sinhala: __NEXT_DATA__ not found');
        return [];
      }

      let nextData: any;
      try {
        nextData = JSON.parse(nextDataRaw);
      } catch {
        console.warn('BBC Sinhala: failed to parse __NEXT_DATA__');
        return [];
      }

      const pageData = nextData?.props?.pageProps?.pageData;
      if (!pageData) {
        console.warn('BBC Sinhala: pageData missing');
        return [];
      }

      const news: BBCSinhalaArticle[] = [];

      const curations = pageData?.curations ?? [];

      for (const curation of curations) {
        const summaries = curation?.summaries ?? [];

        for (const item of summaries) {
          if (item.type !== 'article') continue;

          const title = cleanField(item?.title, 300);
          const source = safeUrl(item?.link, BBC);
          const image = item?.imageUrl
            ? safeUrl(String(item.imageUrl).replace('{width}', '640'), BBC)
            : null;
          const dateISO = cleanField(item?.firstPublished, 40) || null;

          if (title && source) {
            news.push({ title, source, image, dateISO });
          }
        }
      }

      await this.cache.set(key, news, 60_000); // 60 seconds
      return news;
    } catch (error) {
      console.error('BBC Sinhala scrape error:', error);
      return [];
    }
  }

  async latestNewsFirstTamil() {
    try {
      const key = `latest-news:newsFirstTamil`;
      const cached = await this.cache.get(key);
      if (cached) {
        return cached;
      }

      const SITE = 'https://tamil.newsfirst.lk';
      const html = (await this.fetchWithTimeout(`${SITE}/`)) as string;
      const $ = cheerio.load(html);

      const latest = [];
      const breaking = [];
      const breaking_latest = [];
      const archive = [];

      $('.latest_news_main_div').each((_, el) => {
        const item = $(el);
        latest.push({
          title: cleanField(item.find('h4.sub_news_title').text(), 300),
          source: safeUrl(item.find('a').attr('href'), SITE),
          image: safeUrl(item.find('img.latest_news_img').attr('src'), SITE),
          description: cleanField(
            item.find('p.latest_news_detail').text(),
            1000,
          ),
          date: cleanField(item.find('.time_date').text(), 100),
        });
      });
      $(
        '.main_div.top_stories > .ng-star-inserted > a, .top_stories_sub_news a',
      ).each((_, el) => {
        const item = $(el);

        breaking_latest.push({
          title: cleanField(
            item
              .find('h1.top_stories_header, h2.top_stories_sub_title')
              .first()
              .text(),
            300,
          ),

          source: safeUrl(item.attr('href'), SITE),
          image: safeUrl(
            item.find('img.top_stories_img, img.sub_img').attr('src'),
            SITE,
          ),

          description: cleanField(
            item
              .find('.top_stories_details, .top_stories_sub_title_detail')
              .first()
              .text(),
            1000,
          ),

          date: cleanField(item.find('.time_date').first().text(), 100),
        });
      });

      $('.top_stories_main a, .top_stories_sub_news a').each((_, el) => {
        const item = $(el);
        breaking.push({
          title: cleanField(
            item.find('h1, h2.top_stories_sub_title').first().text(),
            300,
          ),
          source: safeUrl(item.attr('href'), SITE),
          image: safeUrl(item.find('img').attr('src'), SITE),
          description: cleanField(
            item
              .find('.top_stories_details, .top_stories_sub_title_detail')
              .text(),
            1000,
          ),
          date: cleanField(item.find('.time_date').text(), 100),
        });
      });

      $('.featured_news_main a').each((_, el) => {
        const item = $(el);
        archive.push({
          title: cleanField(item.find('h4.sub_news_title').text(), 300),
          source: safeUrl(item.attr('href'), SITE),
          image: safeUrl(item.find('img').attr('src'), SITE),
          description: cleanField(
            item.find('.sub_news_detail_guest').text(),
            1000,
          ),
          date: cleanField(item.find('.time_date').text(), 100),
        });
      });

      const payload = { latest, breaking_latest, breaking, archive };
      await this.cache.set(key, payload, 60_000); // 60 seconds

      return payload;
    } catch (error) {
      console.error('latestNewsFirstTamil error:', error);
      return { latest: [], breaking_latest: [], breaking: [], archive: [] };
    }
  }

  async latestNewsWire() {
    try {
      const key = `latest-news:newsWire`;
      const cached = await this.cache.get(key);
      if (cached) {
        return cached;
      }

      const SITE = 'https://www.newswire.lk';
      const html = (await this.fetchWithTimeout(`${SITE}/`)) as string;
      const $ = cheerio.load(html);

      const latest = [];
      const lead_story = [];
      const trending = [];
      const moreNews = [];

      $('.content-block').each((_, el) => {
        const item = $(el);
        lead_story.push({
          title: cleanField(item.find('.content-block-title a').text(), 300),
          source: safeUrl(
            item.find('.content-block-title a').attr('href'),
            SITE,
          ),
          image: safeUrl(
            item.find('.entry-featured-img-wrap img').attr('src'),
            SITE,
          ),
        });
      });

      $('#hootkit-posts-list-5 .posts-listunit').each((_, el) => {
        const item = $(el);
        latest.push({
          title: cleanField(item.find('.posts-listunit-title a').text(), 300),
          source: safeUrl(
            item.find('.posts-listunit-title a').attr('href'),
            SITE,
          ),
          image: safeUrl(
            item.find('.posts-listunit-image img').attr('src'),
            SITE,
          ),
          date: cleanField(item.find('time.entry-published').text(), 100),
          datetime:
            cleanField(
              item.find('time.entry-published').attr('datetime'),
              40,
            ) || null,
        });
      });

      $('#hootkit-posts-grid-1 .post-gridunit').each((_, el) => {
        const item = $(el);
        trending.push({
          title: cleanField(item.find('.post-gridunit-title').text(), 300),
          source: safeUrl(
            item.find('.post-gridunit-title a').attr('href'),
            SITE,
          ),
          image: safeUrl(item.find('.post-gridunit-img').attr('src'), SITE),
        });
      });

      $('#super_rss_reader-10 .srr-item').each((_, el) => {
        const item = $(el);

        moreNews.push({
          title: cleanField(item.find('.srr-title a').text(), 300),
          source: safeUrl(item.find('.srr-title a').attr('href'), SITE),
          image: safeUrl(item.find('.srr-thumb img').attr('src'), SITE),
          description: cleanField(item.find('.srr-summary p').text(), 1000),
          date: cleanField(item.find('time.srr-date').text(), 100),
          datetime:
            cleanField(item.find('time.srr-date').attr('title'), 80) || null,
        });
      });

      const payload = { lead_story, latest, trending, moreNews };
      await this.cache.set(key, payload, 60_000); // 60 seconds

      return payload;
    } catch (error) {
      console.error('latestNewsWire error:', error);
      return { lead_story: [], latest: [], trending: [], moreNews: [] };
    }
  }

  async latestAdaDerana() {
    try {
      const key = `latest-news:adaDerana`;
      const cached = await this.cache.get(key);
      if (cached) {
        return cached;
      }

      const SITE = 'https://www.adaderana.lk/';
      const html = (await this.fetchWithTimeout(SITE, 8000)) as string;
      const $ = cheerio.load(html);

      const lead_story = [];
      const hot_news = [];
      const technology = [];
      const entertainment = [];

      $('.top-story .news-story').each((_, el) => {
        const item = $(el);
        const link = item.find('.story-text h3 a').first();
        lead_story.push({
          title: cleanField(link.text(), 300, { typographic: true }),
          description: cleanField(item.find('.story-text p').text(), 1000, {
            typographic: true,
          }),
          image: safeUrl(item.find('.thumb-image img').attr('src'), SITE),
          source: safeUrl(link.attr('href'), SITE),
        });
      });

      $('.wr-hot-news .hidden-xs .hot-news.news-story').each((_, el) => {
        const item = $(el);
        const link = item.find('.story-text h3 a').first();
        hot_news.push({
          title: cleanField(link.text(), 300, { typographic: true }),
          source: safeUrl(link.attr('href'), SITE),
          image: safeUrl(item.find('.thumb-image img').attr('src'), SITE),
          description: cleanField(
            item.find('.story-text p').first().text(),
            1000,
            {
              typographic: true,
            },
          ),
          time: cleanField(item.find('.comments span').last().text(), 100),
        });
      });

      $('.news-section .technology.news-story').each((_, el) => {
        const item = $(el);
        const link = item.find('.story-text h3 a').first();
        technology.push({
          title: cleanField(link.text(), 300, { typographic: true }),
          source: safeUrl(link.attr('href'), SITE),
          image: safeUrl(
            item.find('.lead-story-image img').attr('src') ||
              item.find('.thumb-image img').attr('src'),
            SITE,
          ),
          description: cleanField(
            item.find('.story-text p.hidden-xs').first().text(),
            1000,
            { typographic: true },
          ),
          date: cleanField(item.find('.comments span').last().text(), 100),
        });
      });

      $('.news-section.hidden-xs .entertainment.news-story').each((_, el) => {
        const item = $(el);
        const link = item.find('.story-text h3 a').first();
        entertainment.push({
          title: cleanField(link.text(), 300, { typographic: true }),
          source: safeUrl(link.attr('href'), SITE),
          image: safeUrl(
            item.find('.lead-story-image img').attr('src') ||
              item.find('.thumb-image img').attr('src'),
            SITE,
          ),
          description: cleanField(
            item.find('.story-text p.hidden-xs').first().text(),
            1000,
            { typographic: true },
          ),
          date: cleanField(item.find('.comments span').last().text(), 100),
        });
      });

      const payload = { lead_story, hot_news, technology, entertainment };
      await this.cache.set(key, payload, 60_000); // 60 seconds
      return payload;
    } catch (error) {
      console.error('latestAdaDerana error:', error);
      return { lead_story: [], hot_news: [], technology: [], entertainment: [] };
    }
  }
}
