/* eslint-disable prettier/prettier */
import { Controller, Get, Param } from '@nestjs/common';
import { LatestNewsService } from './latest-news.service';

@Controller('latest-news')
export class LatestNewsController {
  constructor(private readonly latestNewsService: LatestNewsService) {}

  //Get Lanka Deepa News
  @Get('lankadepa/:page')
  async findOne(@Param('page') page: string) {
    try {
      const latestContent = await this.latestNewsService.latestLankadeepa(+page);
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

}
