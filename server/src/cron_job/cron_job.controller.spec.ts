import { Test, TestingModule } from '@nestjs/testing';
import { CronJobController } from './cron_job.controller';
import { CronJobService } from './cron_job.service';

describe('CronJobController', () => {
  let controller: CronJobController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CronJobController],
      providers: [CronJobService],
    }).compile();

    controller = module.get<CronJobController>(CronJobController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
