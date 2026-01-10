import { PartialType } from '@nestjs/mapped-types';
import { CreateCronJobDto } from './create-cron_job.dto';

export class UpdateCronJobDto extends PartialType(CreateCronJobDto) {}
