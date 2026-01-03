import { PartialType } from '@nestjs/mapped-types';
import { CreateLatestNewDto } from './create_latest_news.dto';

export class UpdateLatestNewDto extends PartialType(CreateLatestNewDto) {}
