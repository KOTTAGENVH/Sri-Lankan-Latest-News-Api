import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LatestNewsService } from './latest_news.service';
import { PublicApiGuard } from '../helper/api_guard';

@UseGuards(PublicApiGuard)
@Controller('latest-news')
export class LatestNewsController {
  constructor(private readonly latestNewsService: LatestNewsService) {}

  private async withAttribution<T>(
    sourceKey: string,
    work: () => Promise<T>,
  ): Promise<{ latestContent: T; attribution: any }> {
    const latestContent = await work();
    const attribution = await this.latestNewsService.attribution(sourceKey);
    return { latestContent, attribution };
  }

  // Get Lanka Deepa News (v1)
  @Get(['lankadepa/v1/:page', 'lankadepa/v1/:page/:section'])
  async findLankadepa(
    @Param('page', ParseIntPipe) page: number,
    @Param('section', new ParseIntPipe({ optional: true })) section?: number,
  ) {
    try {
      return await this.withAttribution('lankadeepa', () =>
        this.latestNewsService.latestLankadeepa(page, section),
      );
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }

  // Get BBC Sinhala News (v1)
  @Get('bbcsinhala/v1/:page')
  async findBBCSinhala_v1(@Param('page', ParseIntPipe) page: number) {
    try {
      return await this.withAttribution('bbcSinhala', () =>
        this.latestNewsService.latestBBCSinhala(page),
      );
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }

  // Get News First News (Tamil)
  @Get('newsfirsttamil/v1')
  async findNewsFirstTamil() {
    try {
      return await this.withAttribution('newsFirstTamil', () =>
        this.latestNewsService.latestNewsFirstTamil(),
      );
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }

  // Get News from Newswire English
  @Get('newswire/v1')
  async findNewswire() {
    try {
      return await this.withAttribution('newswire', () =>
        this.latestNewsService.latestNewsWire(),
      );
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }

  // Get News from Ada Derana English
  @Get('adaderana/v1')
  async findAdaDerana() {
    try {
      return await this.withAttribution('adaderana', () =>
        this.latestNewsService.latestAdaDerana(),
      );
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }

  // IRD - News / Notices
  @Get(['ird/news/v1', 'ird/news/v1/:page'])
  async findIrdNews(
    @Param('page', new ParseIntPipe({ optional: true })) page = 1,
  ) {
    try {
      return await this.withAttribution('ird', () =>
        this.latestNewsService.latestIrdNotices(page),
      );
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }

  // IRD - Latest Content Listing
  @Get(['ird/content/v1', 'ird/content/v1/:page'])
  async findIrdContent(
    @Param('page', new ParseIntPipe({ optional: true })) page = 1,
  ) {
    try {
      return await this.withAttribution('ird', () =>
        this.latestNewsService.latestIrdContent(page),
      );
    } catch (error) {
      return { error: 'Error fetching latest news' };
    }
  }

  // Merged CISA KEV + ENISA EUVD + NIST NVD feed
  @Get('cyber/vulns/v1')
  async findVulnFeed(
    @Query('limit', new DefaultValuePipe(40), ParseIntPipe) limit: number,
  ) {
    try {
      const latestContent = await this.latestNewsService.latestVulnFeed(
        Math.min(limit, 200),
      );
      const attribution = await Promise.all([
        this.latestNewsService.attribution('cisa'),
        this.latestNewsService.attribution('euvd'),
      ]);
      return { latestContent, attribution };
    } catch (error) {
      return { error: 'Error fetching vulnerability feed' };
    }
  }
  // Dashboard counters
  @Get('cyber/stats/v1')
  async findVulnStats() {
    try {
      const latestContent = await this.latestNewsService.vulnStats();
      const attribution = await Promise.all([
        this.latestNewsService.attribution('cisa'),
        this.latestNewsService.attribution('euvd'),
      ]);
      return { latestContent, attribution };
    } catch (error) {
      return { error: 'Error building vulnerability stats' };
    }
  }

  // CISA Known Exploited Vulnerabilities
  @Get('cyber/kev/v1')
  async findKev(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    try {
      return await this.withAttribution('cisa', () =>
        this.latestNewsService.latestKev(limit),
      );
    } catch (error) {
      return { error: 'Error fetching KEV catalog' };
    }
  }

  // ENISA EUVD - latest | critical | exploited
  @Get('cyber/euvd/v1/:type')
  async findEuvd(@Param('type') type: 'latest' | 'critical' | 'exploited') {
    if (type !== 'latest' && type !== 'critical' && type !== 'exploited') {
      throw new BadRequestException(
        'type must be latest | critical | exploited',
      );
    }
    try {
      return await this.withAttribution('euvd', () =>
        this.latestNewsService.latestEuvd(type),
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      return { error: 'Error fetching EUVD data' };
    }
  }

  // ENISA EUVD search
  @Get('cyber/euvd/search/v1')
  async searchEuvd(
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
    @Query('text') text?: string,
    @Query('vendor') vendor?: string,
    @Query('product') product?: string,
    @Query('fromScore') fromScore?: string,
    @Query('fromDate') fromDate?: string,
  ) {
    try {
      const latestContent = await this.latestNewsService.searchEuvd({
        text,
        vendor,
        product,
        fromDate,
        fromScore: fromScore ? Number(fromScore) : undefined,
        size: Math.min(size, 100),
      });
      return { latestContent };
    } catch (error) {
      return { error: 'Error searching EUVD' };
    }
  }

  // NVD - single CVE lookup (CVSS + description)
  @Get('cyber/nvd/v1/:id')
  async findNvd(@Param('id') id: string) {
    try {
      const result = await this.withAttribution('nvd', () =>
        this.latestNewsService.nvdCvss(id),
      );
      if (!result.latestContent) {
        throw new BadRequestException('Invalid CVE id');
      }
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      return { error: 'Error fetching CVE details' };
    }
  }

  // Wikipedia - Portal:Current events (optional YYYY-MM-DD)
  @Get(['wiki/events/v1', 'wiki/events/v1/:date'])
  async findWikiEvents(@Param('date') date?: string) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
    try {
      return await this.withAttribution('wikievents', () =>
        this.latestNewsService.currentWikiEvents(date),
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      return { error: 'Error fetching current events' };
    }
  }

  // Wikivoyage - destination summary
  @Get('wiki/guide/v1/:destination')
  async findCountryGuide(@Param('destination') destination: string) {
    try {
      const result = await this.withAttribution('wikivoyage', () =>
        this.latestNewsService.countryGuide(destination),
      );
      if (!result.latestContent) {
        throw new BadRequestException('Invalid or unknown destination');
      }
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      return { error: 'Error fetching destination guide' };
    }
  }

  // UN News - all | africa | americas | asia | europe | middle-east
  @Get(['un/v1', 'un/v1/:region'])
  async findUnNews(@Param('region') region = 'all') {
    const regions = [
      'all',
      'africa',
      'americas',
      'asia',
      'europe',
      'middle-east',
    ] as const;
    if (!regions.includes(region as any)) {
      throw new BadRequestException(`region must be ${regions.join(' | ')}`);
    }
    try {
      return await this.withAttribution('un', () =>
        this.latestNewsService.latestUnNews(region as any),
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      return { error: 'Error fetching UN news' };
    }
  }

  //Exception filter testing
  // @Get('debug/boom/:kind')
  // boom(@Param('kind') kind: string) {
  //   if (kind === 'http') {
  //     throw new BadRequestException('this should still be visible');
  //   }
  //   throw new Error('SECRET_KEY=hunter2 /home/nuwan/project/src/whatever.ts');
  // }
}
