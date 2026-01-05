import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { News, NewsDocument } from 'src/database/mongodb/schemas/news.schema';
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
}
