import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { News, NewsDocument } from '../database/mongodb/schemas/news.schema';
import { Cache } from 'cache-manager';

@Injectable()
export class HistoryService {
  private readonly TTL = 60; // seconds
  constructor(
    @InjectModel(News.name)
    private readonly newsModel: Model<NewsDocument>,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async getAllNews(page = 1) {
    const limit = 20;
    const skip = (page - 1) * limit;
    const key = `news:all:${page}:${limit}`;

    const cached = await this.cache.get<News[]>(key);
    if (cached) return cached;

    const data = await this.newsModel
      .find()
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    await this.cache.set(key, data, this.TTL);
    return data;
  }

  async getNewsBySource(source: number, page = 1) {
    const limit = 20;
    const skip = (page - 1) * limit;
    const key = `news:source:${source}:${page}:${limit}`;

    const cached = await this.cache.get<News[]>(key);
    if (cached) return cached;

    let querySource: string;

    switch (source) {
      case 0:
        querySource = 'lankadeepa';
        break;
      case 1:
        querySource = 'deshaya';
        break;
      case 2:
        querySource = 'bbcSinhala';
        break;
      case 3:
        querySource = 'newswire';
        break;
      case 4:
        querySource = 'adaderana';
        break;
      case 5:
        querySource = 'newsfirst_tamil';
        break;
      default:
        throw new BadRequestException('Invalid source number');
    }

    const data = await this.newsModel
      .find({ source: querySource })
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    await this.cache.set(key, data, this.TTL);
    return data;
  }

  async getNewsbyDate(date: Date, page = 1) {
    const limit = 20;
    const skip = (page - 1) * limit;
    const day = date.toISOString().split('T')[0];
    const key = `news:date:${day}:${page}:${limit}`;

    const cached = await this.cache.get<News[]>(key);
    if (cached) return cached;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const data = await this.newsModel
      .find({
        publishedAt: { $gte: startOfDay, $lte: endOfDay },
      })
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    await this.cache.set(key, data, this.TTL);
    return data;
  }

  async sematicSearchByQuery(text: String, limit = 10) {
    try {
      const key = `embeddingtext:${text}:limit:${limit}`;
      const cached = await this.cache.get<any[]>(key);
      if (cached) {
        return cached;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch('http://0.0.0.0:8000/embed/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          embedding_news_api_key: process.env.EMBEDDING_API_KEY!,
        },
        body: JSON.stringify({ text: text }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetail;
        try {
          errorDetail = await response.json();
        } catch (e) {
          errorDetail = await response.text();
        }

        throw new BadGatewayException({
          message: 'Embedding service error',
          statusCode: response.status,
          detail: errorDetail,
        });
      }

      const responseData = await response.json();
      const embedding = responseData.embedding;

      const agg = [
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'plot_embedding',
            queryVector: embedding,
            numCandidates: 150,
            limit: limit,
          },
        },
        {
          $project: {
            _id: 0,
            id: 1,
            title: 1,
            description: 1,
            source: 1,
            publishedAt: 1,
            url: 1,
            imageUrl: 1,
            category: 1,
            fetchedAt: 1,
            score: {
              $meta: 'vectorSearchScore',
            },
          },
        },
      ];

      const result = await this.newsModel.aggregate(agg);
      await this.cache.set(key, result, 60 * 60);
      return result;
    } catch (error: any) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      if (error.name === 'AbortError') {
        throw new GatewayTimeoutException('Embedding service timed out');
      }
      if (error instanceof TypeError) {
        throw new BadGatewayException('Embedding service unreachable');
      }

      throw new InternalServerErrorException('Failed to generate embedding');
    }
  }

  async atlasSearchByQuery(text: String, limit = 10) {
    try {
      const key = `atlastext:${text}:limit:${limit}`;
      const cached = await this.cache.get<any[]>(key);
      if (cached) {
        return cached;
      }

      const agg = [
        {
          $search: {
            index: 'news',
            text: {
              query: text,
              path: ['title', 'description'],
              fuzzy: {
                maxEdits: 2,
              },
            },
          },
        },
        {
          $limit: limit,
        },
        {
          $project: {
            _id: 0,
            id: 1,
            title: 1,
            description: 1,
            source: 1,
            publishedAt: 1,
            fetchedAt: 1,
            url: 1,
            imageUrl: 1,
            category: 1,
            score: {
              $meta: 'searchScore',
            },
          },
        },
      ];

      const result = await this.newsModel.aggregate(agg);
      await this.cache.set(key, result, 60 * 60);

      return result;
    } catch (error: any) {
      throw new InternalServerErrorException('Atlas search failed');
    }
  }
}
