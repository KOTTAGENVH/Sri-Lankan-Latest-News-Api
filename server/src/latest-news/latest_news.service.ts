import { Inject, Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { cleanText } from '../helper/cleanText';
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
  ): Promise<string | ArrayBuffer> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      return asArrayBuffer
        ? await response.arrayBuffer()
        : await response.text();
    } finally {
      clearTimeout(id);
    }
  }

  async latestLankadeepa(
    page: number,
    section?: number,
  ): Promise<LankadeepaArticle[]> {
    try {
      const key = `latest-news:lankadeepa:${page}:${section ?? ''}`;
      const cached = await this.cache.get<LankadeepaArticle[]>(key);
      if (cached) {
        return cached;
      }

      const url = section
        ? `https://www.lankadeepa.lk/latest_news/${page}/${section}`
        : `https://www.lankadeepa.lk/latest_news/${page}`;

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

      const result = [];

      articles_lead.each((_, article) => {
        const el = $(article);

        const articles_lead_link = el.find('a').attr('href')?.trim() || null;
        const articles_lead_image = el.find('img').attr('src')?.trim() || null;
        const articles_lead_title = el.find('h2.cat-lead-title').text().trim();
        const articles_lead_description = el
          .find('p.cat-lead-teaser')
          .text()
          .trim();
        const articles_lead_time = el.find('.story-meta span').text().trim();

        result.push({
          article_lead: {
            source: articles_lead_link,
            image: articles_lead_image,
            title: articles_lead_title,
            description: articles_lead_description,
            time: articles_lead_time,
          },
        });
      });

      articles_list.each((_, article) => {
        const el = $(article);

        const articles_list_link = el.find('a').attr('href')?.trim() || null;
        const articles_list_image = el.find('img').attr('src')?.trim() || null;
        const articles_list_title = el.find('h3.cat-item-title').text().trim();
        const articles_list_description = el
          .find('p.cat-item-teaser')
          .text()
          .trim();
        const articles_list_time = el.find('.story-meta span').text().trim();

        result.push({
          article_list: {
            source: articles_list_link,
            image: articles_list_image,
            title: articles_list_title,
            description: articles_list_description,
            time: articles_list_time,
          },
        });
      });

      articles_trending.each((_, article) => {
        const el = $(article);

        const articles_trending_link =
          el.find('a').attr('href')?.trim() || null;
        const articles_trending_image =
          el.find('img').attr('src')?.trim() || null;
        const articles_trending_title =
          el.find('h3.me-feature-title').text().trim() ||
          el.find('h4.me-item-title').text().trim();
        const articles_trending_description = el
          .find('p.me-feature-teaser')
          .text()
          .trim();
        const articles_trending_time = el
          .find('.story-meta span')
          .text()
          .trim();

        result.push({
          article_trending: {
            source: articles_trending_link,
            image: articles_trending_image,
            title: articles_trending_title,
            description: articles_trending_description,
            time: articles_trending_time,
          },
        });
      });

      if (result.length === 0 || !result) {
        return [];
      }
      await this.cache.set(key, result, 60_000); // 60 seconds
      return result;
    } catch (error) {
      console.error('Error fetching data:', error);
      return [];
    }
  }

  async latestDeshaya(page: number): Promise<DeshayaArticle[]> {
    try {
      const key = `latest-news:deshaya:${page}`;
      const cached = await this.cache.get<DeshayaArticle[]>(key);
      if (cached) {
        return cached;
      }

      const html = (await this.fetchWithTimeout(
        `https://www.deshaya.lk/43/features/${page}`,
      )) as string;
      const $ = cheerio.load(html);

      // Arrays to store extracted data
      const titles = [];
      const sources = [];
      const descriptions = [];
      const times = [];

      $('.sec-1-ite-tit').each((index, element) => {
        titles.push($(element).find('a').text().trim());
        sources.push($(element).find('a').attr('href').trim());
      });

      $('.sec-1-ite-tex').each((index, element) => {
        descriptions.push($(element).text().trim());
      });

      $('.sec-1-ite-com').each((index, element) => {
        times.push($(element).text().trim());
      });

      if (
        titles.length === sources.length &&
        titles.length === descriptions.length &&
        titles.length === times.length
      ) {
        const result = titles.map((title, index) => ({
          title,
          description: descriptions[index],
          source: sources[index],
          time: times[index],
        }));
        await this.cache.set(key, result, 60_000); // 60 seconds
        return result;
      } else {
        throw new Error(
          'Data extraction error: lengths of arrays are not equal',
        );
      }
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }

  async latestBBCSinhala(page: number): Promise<BBCSinhalaArticle[]> {
    try {
      const key = `latest-news:bbcSinhala:${page}`;
      const cached = await this.cache.get<BBCSinhalaArticle[]>(key);
      if (cached) {
        return cached;
      }

      const html = (await this.fetchWithTimeout(
        `https://www.bbc.com/sinhala/topics/cg7267dz901t?page=${page}`,
      )) as string;
      const $ = cheerio.load(html);

      const nextDataRaw = $('#__NEXT_DATA__').html();
      if (!nextDataRaw) {
        console.warn('BBC Sinhala: __NEXT_DATA__ not found');
        return [];
      }
      const nextData = JSON.parse(nextDataRaw);

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

          const title = item?.title?.trim();
          const source = item?.link ?? null;

          const image = item?.imageUrl
            ? item.imageUrl.replace('{width}', '640')
            : null;

          const dateISO = item?.firstPublished ?? null;

          if (title && source) {
            news.push({
              title,
              source,
              image,
              dateISO,
            });
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

      const html = (await this.fetchWithTimeout(
        'https://tamil.newsfirst.lk/',
      )) as string;
      const $ = cheerio.load(html);

      const latest = [];
      const breaking = [];
      const breaking_latest = [];
      const archive = [];
      $('.latest_news_main_div').each((_, el) => {
        const item = $(el);
        latest.push({
          title: item.find('h4.sub_news_title').text().trim(),
          source: item.find('a').attr('href') || null,
          image: item.find('img.latest_news_img').attr('src') || null,
          description: item.find('p.latest_news_detail').text().trim(),
          date: item.find('.time_date').text().trim(),
        });
      });
      $(
        '.main_div.top_stories > .ng-star-inserted > a, .top_stories_sub_news a',
      ).each((_, el) => {
        const item = $(el);

        breaking_latest.push({
          title: item
            .find('h1.top_stories_header, h2.top_stories_sub_title')
            .first()
            .text()
            .trim(),

          source: item.attr('href') || null,

          image:
            item.find('img.top_stories_img, img.sub_img').attr('src') || null,

          description: item
            .find('.top_stories_details, .top_stories_sub_title_detail')
            .first()
            .text()
            .trim(),

          date: item.find('.time_date').first().text().trim(),
        });
      });
      $('.top_stories_main a, .top_stories_sub_news a').each((_, el) => {
        const item = $(el);
        breaking.push({
          title: item
            .find('h1, h2.top_stories_sub_title')
            .first()
            .text()
            .trim(),
          source: item.attr('href') || null,
          image: item.find('img').attr('src') || null,
          description: item
            .find('.top_stories_details, .top_stories_sub_title_detail')
            .text()
            .trim(),
          date: item.find('.time_date').text().trim(),
        });
      });
      $('.featured_news_main a').each((_, el) => {
        const item = $(el);
        archive.push({
          title: item.find('h4.sub_news_title').text().trim(),
          source: item.attr('href') || null,
          image: item.find('img').attr('src') || null,
          description: item.find('.sub_news_detail_guest').text().trim(),
          date: item.find('.time_date').text().trim(),
        });
      });
      await this.cache.set(
        key,
        { latest, breaking_latest, breaking, archive },
        60_000,
      ); // 60 seconds
      return { latest, breaking_latest, breaking, archive };
    } catch (error) {
      console.error(error);
      return { latest: [], breaking: [], archive: [] };
    }
  }

  async latestNewsWire() {
    try {
      const key = `latest-news:newsWire`;
      const cached = await this.cache.get(key);
      if (cached) {
        return cached;
      }

      const html = (await this.fetchWithTimeout(
        'https://www.newswire.lk/',
      )) as string;
      const $ = cheerio.load(html);

      const latest = [];
      const lead_story = [];
      const trending = [];
      const moreNews = [];
      $('.content-block').each((_, el) => {
        const item = $(el);
        lead_story.push({
          title: item.find('.content-block-title a').text().trim(),

          source: item.find('.content-block-title a').attr('href') || null,

          image: item.find('.entry-featured-img-wrap img').attr('src') || null,
        });
      });
      $('#hootkit-posts-list-5 .posts-listunit').each((_, el) => {
        const item = $(el);
        latest.push({
          title: item.find('.posts-listunit-title a').text().trim(),

          source: item.find('.posts-listunit-title a').attr('href') || null,

          image: item.find('.posts-listunit-image img').attr('src') || null,

          date: item.find('time.entry-published').text().trim(),

          datetime: item.find('time.entry-published').attr('datetime') || null,
        });
      });
      $('#hootkit-posts-grid-1 .post-gridunit').each((_, el) => {
        const item = $(el);
        trending.push({
          title: item.find('.post-gridunit-title').text().trim(),
          source: item.find('.post-gridunit-title a').attr('href') || null,
          image: item.find('.post-gridunit-img').attr('src') || null,
        });
      });
      $('#super_rss_reader-10 .srr-item').each((_, el) => {
        const item = $(el);

        moreNews.push({
          title: item.find('.srr-title a').text().trim(),

          source: item.find('.srr-title a').attr('href') || null,

          image: item.find('.srr-thumb img').attr('src') || null,

          description: item.find('.srr-summary p').text().trim(),

          date: item.find('time.srr-date').text().trim(),

          datetime: item.find('time.srr-date').attr('title') || null,
        });
      });
      await this.cache.set(
        key,
        { lead_story, latest, trending, moreNews },
        60_000,
      ); // 60 seconds
      return { lead_story, latest, trending, moreNews };
    } catch (error) {
      console.error(error);
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

      const arrayBuffer = (await this.fetchWithTimeout(
        'https://www.adaderana.lk/',
        8000,
        true,
      )) as ArrayBuffer;
      const html = Buffer.from(arrayBuffer).toString('utf8');
      const $ = cheerio.load(html);

      const lead_story = [];
      const hot_news = [];
      const technology = [];
      const entertainment = [];
      $('.top-story .news-story').each((_, el) => {
        const item = $(el);

        lead_story.push({
          title: cleanText(item.find('.story-text h3 a').text().trim()),

          description: cleanText(item.find('.story-text p').text().trim()),

          image: item.find('.thumb-image img').attr('src') || null,

          source: item.find('.story-text h3 a').attr('href') || null,
        });
      });
      $('.wr-hot-news .hidden-xs .hot-news.news-story').each((_, el) => {
        const item = $(el);

        const link = item.find('.story-text h3 a').first();

        hot_news.push({
          title: cleanText(link.text()),

          source: link.attr('href')
            ? `https://www.adaderana.lk/${link.attr('href')}`
            : null,

          image: item.find('.thumb-image img').attr('src') || null,

          description: cleanText(
            item.find('.story-text p').first().text().trim(),
          ),

          time: item.find('.comments span').last().text().trim(),
        });
      });
      $('.news-section .technology.news-story').each((_, el) => {
        const item = $(el);

        const link = item.find('.story-text h3 a').first();

        technology.push({
          title: cleanText(link.text()),

          source: link.attr('href')
            ? `https://www.adaderana.lk/${link.attr('href')}`
            : null,

          image:
            item.find('.lead-story-image img').attr('src') ||
            item.find('.thumb-image img').attr('src') ||
            null,

          description: cleanText(
            item.find('.story-text p.hidden-xs').first().text().trim(),
          ),
          date: item.find('.comments span').last().text().trim(),
        });
      });
      $('.news-section.hidden-xs .entertainment.news-story').each((_, el) => {
        const item = $(el);

        const link = item.find('.story-text h3 a').first();

        entertainment.push({
          title: link.text().replace(/\s+/g, ' ').trim(),

          source: link.attr('href')
            ? `https://www.adaderana.lk/${link.attr('href')}`
            : null,

          image:
            item.find('.lead-story-image img').attr('src') ||
            item.find('.thumb-image img').attr('src') ||
            null,

          description: cleanText(
            item.find('.story-text p.hidden-xs').first().text().trim(),
          ),
          date: item.find('.comments span').last().text().trim(),
        });
      });
      await this.cache.set(
        key,
        { lead_story, hot_news, technology, entertainment },
        60_000,
      ); // 60 seconds
      return { lead_story, hot_news, technology, entertainment };
    } catch (error) {
      console.error(error);
      return { lead_story: [], latest: [], trending: [], moreNews: [] };
    }
  }
}
