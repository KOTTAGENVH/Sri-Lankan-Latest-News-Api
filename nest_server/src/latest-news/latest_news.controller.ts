/* eslint-disable prettier/prettier */
import { Controller, Get, Param, UseInterceptors } from '@nestjs/common';
import { LatestNewsService } from './latest_news.service';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@Controller('latest-news')
export class LatestNewsController {
  constructor(private readonly latestNewsService: LatestNewsService) {}

  //Get Lanka Deepa News
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60)
  @Get('lankadepa/:page/:section?')
  async findOne(
    @Param('page') page: string,
    @Param('section') section?: string,
  ) {
    try {
      const latestContent = await this.latestNewsService.latestLankadeepa(
        +page,
        section ? +section : undefined,
      );
      return { latestContent };
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }

  //Get Deshaya News
  @Get('deshaya/:page')
  async findDeshaya(@Param('page') page: string) {
    try {
      const latestContent = await this.latestNewsService.latestDeshaya(+page);
      return { latestContent };
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }

  //Get BBC Sinhala News
  @Get('bbcsinhala')
  async findBBCSinhala() {
    try {
      const latestContent = await this.latestNewsService.latestBBCSinhala();
      return { latestContent };
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }

  //Get News First News (Tamil)
  @Get('newsfirsttamil')
  async findNewsFirstTamil() {
    try {
      const latestContent = await this.latestNewsService.latestNewsFirstTamil();
      return { latestContent };
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }
}
