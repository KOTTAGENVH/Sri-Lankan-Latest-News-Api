import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class History {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  source: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  imageUrl?: string;

  @Field({ nullable: true })
  url?: string;

  @Field({ nullable: true })
  category?: string;

  @Field({ nullable: true })
  publishedAt?: Date;

  @Field()
  fetchedAt: Date;
}
