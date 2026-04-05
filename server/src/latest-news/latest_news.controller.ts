import { Controller, Get, Param } from '@nestjs/common';
import { LatestNewsService } from './latest_news.service';

@Controller('latest-news')
export class LatestNewsController {
  constructor(private readonly latestNewsService: LatestNewsService) {}

  //Get Lanka Deepa News
  @Get(['lankadepa/:page', 'lankadepa/:page/:section'])
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
  @Get('bbcsinhala/:page')
  async findBBCSinhala(@Param('page') page: string) {
    try {
      const latestContent =
        await this.latestNewsService.latestBBCSinhala(+page);
      return { latestContent };
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }

  //Get Lanka Deepa News
  @Get(['lankadepa/v1/:page', 'lankadepa/v1/:page/:section'])
  async findLankadepa(
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
  @Get('deshaya/v1/:page')
  async findDeshaya_v1(@Param('page') page: string) {
    try {
      const latestContent = await this.latestNewsService.latestDeshaya(+page);
      return { latestContent };
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }

  //Get BBC Sinhala News
  @Get('bbcsinhala/v1/:page')
  async findBBCSinhala_v1(@Param('page') page: string) {
    try {
      const latestContent =
        await this.latestNewsService.latestBBCSinhala(+page);
      return { latestContent };
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }

  //Get News First News (Tamil)
  @Get('newsfirsttamil/v1')
  async findNewsFirstTamil() {
    try {
      const latestContent = await this.latestNewsService.latestNewsFirstTamil();
      return { latestContent };
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }

  //Get News  from Newswire English
  @Get('newswire/v1')
  async findNewswire() {
    try {
      const latestContent = await this.latestNewsService.latestNewsWire();
      return { latestContent };
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }

  //Get News from Ada Derana English
  @Get('adaderana/v1')
  async findAdaDerana() {
    try {
      const latestContent = await this.latestNewsService.latestAdaDerana();
      return { latestContent };
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }
}
