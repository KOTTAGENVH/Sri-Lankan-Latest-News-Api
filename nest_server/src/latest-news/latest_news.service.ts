import { Inject, Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import axios, { AxiosResponse } from 'axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class LatestNewsService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async latestLankadeepa(page: number, section?: number) {
    try {
      const key = `latest-news:lankadeepa:${page}:${section ?? ''}`;
      const cached = await this.cache.get(key);
      if (cached) {
        return cached;
      }
      const response = await axios.get(
        section
          ? `https://www.lankadeepa.lk/latest_news/${page}/${section}`
          : `https://www.lankadeepa.lk/latest_news/${page}`,
      );

      const html = response.data;
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
        return 'No data found';
      }
      await this.cache.set(key, result, 60_000); // 60 seconds
      return result;
    } catch (error) {
      console.error('Error fetching data:', error);
      return 'Error fetching data';
    }
  }

  async latestDeshaya(page: number) {
    try {
      const key = `latest-news:deshaya:${page}`;
      const cached = await this.cache.get(key);
      if (cached) {
        return cached;
      }
      const response = await axios.get(
        `https://www.deshaya.lk/43/features/${page}`,
      );
      const html = response.data;
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
          time: times[index]
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

  async latestBBCSinhala() {
    try {
      const response = await axios.get(
        `https://www.bbc.com/sinhala/topics/cg7267dz901t`,
      );
      const html = response.data;
      const $ = cheerio.load(html);

      const titles = [];
      const sources = [];
      const dates = [];

      $('.bbc-6e44zt.e47bds20').each((index, element) => {
        const title = $(element).text();
        titles.push(title);

        // Extracting href from <a> tag inside the element
        const href = $(element).find('a').attr('href');
        sources.push(href);
      });

      $('.promo-timestamp.bbc-11oryzm.e1mklfmt0').each((index, element) => {
        dates.push($(element).text());
      });

      const news = titles.map((title, index) => ({
        title,
        source: sources[index],
        date: dates[index],
      }));

      return news;
    } catch (error) {
      console.error('Error:', error);
      return [];
    }
  }

  async latestNewsFirstTamil() {
    try {
      const response = await axios.get(`https://tamil.newsfirst.lk/`);
      const html = response.data;
      const $ = cheerio.load(html);

      const titles = [];
      const sources = [];
      const descriptions = [];
      $('.jeg_post_title').each((index, element) => {
        const title = $(element).text().trim();
        titles.push(title);
        const href = $(element).find('a').attr('href');
        sources.push(href);
      });

      $('.jeg_post_excerpt').each((index, element) => {
        const description = $(element).text().trim();
        descriptions.push(description);
      });

      const news = titles.map((title, index) => ({
        title,
        source: sources[index],
        description: descriptions[index],
      }));

      return news;
    } catch (error) {
      console.error('Error:', error);
      return [];
    }
  }
}
