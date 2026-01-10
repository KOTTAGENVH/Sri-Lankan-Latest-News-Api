import { Controller, Get, UseGuards } from '@nestjs/common';
import { CronJobService } from './cron_job.service';
import { ApiKeyGuard } from '../helper/api_guard';

@UseGuards(ApiKeyGuard)
@Controller('cronjob/v1')
export class CronJobController {
  constructor(private readonly cronJobService: CronJobService) {}

  @Get('/lankadeepa')
  callCronJobLankadeepa() {
    return this.cronJobService.callCronjobLankadeepa();
  }

  @Get('/deshaya')
  callCronJobDeshaya() {
    return this.cronJobService.callCronjobDeshaya();
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

  @Get('/storageStatus')
  callCronJobMongoStorageStatus() {
    return this.cronJobService.callCronjobMongoDB();
  }
}
