import {
  BadRequestException,
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CronJobService } from './cron_job.service';
import { ApiKeyGuard } from '../helper/api_guard';

@UseGuards(ApiKeyGuard)
@Controller('cronjob/v1')
export class CronJobController {
  constructor(private readonly cronJobService: CronJobService) {}

  @Get('/ird/content')
  callCronJobIrdContent() {
    return this.cronJobService.callCronjobIrdContent();
  }

  @Get('/ird/news')
  callCronJobIrdNews() {
    return this.cronJobService.callCronjobIrdNotices();
  }

  @Get('/cyber/kev')
  callCronJobKev() {
    return this.cronJobService.callCronjobKev();
  }

  @Get('/cyber/euvd/:type')
  callCronJobEuvd(@Param('type') type: 'latest' | 'critical' | 'exploited') {
    if (type !== 'latest' && type !== 'critical' && type !== 'exploited') {
      throw new BadRequestException(
        'type must be latest | critical | exploited',
      );
    }
    return this.cronJobService.callCronjobEuvd(type);
  }

  @Get('/cyber')
  callCronJobCyber() {
    return this.cronJobService.callCronjobCyber();
  }

  @Get('/lankadeepa')
  callCronJobLankadeepa() {
    return this.cronJobService.callCronjobLankadeepa();
  }

  @Get('/bbcsinhala')
  callCronJobBBCSinhala() {
    return this.cronJobService.callCronjobBBCSinhala();
  }

  @Get('/newswire')
  callCronJobNewsWire() {
    return this.cronJobService.callCronjobNewsWire();
  }

  @Get('/adaderana')
  callCronJobAdaderana() {
    return this.cronJobService.callCronjobAdaDerana();
  }

  @Get('/newsfirsttamil')
  callCronJobNewsFirstTamil() {
    return this.cronJobService.callCronjobNewsFirstTamil();
  }

  @Get('/un')
  callCronJobUnNews() {
    return this.cronJobService.callCronjobUnNews();
  }

  @Get('/storageStatus')
  callCronJobMongoStorageStatus() {
    return this.cronJobService.callCronjobMongoDB();
  }
}
