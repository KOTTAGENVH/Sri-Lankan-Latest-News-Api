import { PartialType } from '@nestjs/mapped-types';
import { CreateLatestNewDto } from './create-latest-new.dto';

export class UpdateLatestNewDto extends PartialType(CreateLatestNewDto) {}
