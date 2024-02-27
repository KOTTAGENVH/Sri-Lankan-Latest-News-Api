/* eslint-disable prettier/prettier */
import { Controller, Get, Param } from '@nestjs/common';
import { LatestNewsService } from './latest-news.service';

@Controller('latest-news')
export class LatestNewsController {
  constructor(private readonly latestNewsService: LatestNewsService) {}

  @Get('lankadepa/:page')
  async findOne(@Param('page') page: string) {
    try {
      const latestContent = await this.latestNewsService.latestLankadeepa(+page);
      return { latestContent };
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }
}
