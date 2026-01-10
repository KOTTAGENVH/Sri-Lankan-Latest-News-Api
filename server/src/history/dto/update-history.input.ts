import { CreateHistoryInput } from './create-history.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateHistoryInput extends PartialType(CreateHistoryInput) {
  @Field(() => Int)
  id: number;
}
