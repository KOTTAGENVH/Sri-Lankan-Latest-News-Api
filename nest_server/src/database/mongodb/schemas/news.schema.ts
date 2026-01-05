import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NewsDocument = HydratedDocument<News>;

@Schema({ timestamps: true })
export class News {
  @Prop({ unique: true, required: true })
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ type: Date, index: true })
  publishedAt?: Date;

  @Prop({ type: Date, required: true, index: true })
  fetchedAt: Date;

  @Prop({ required: true, index: true })
  source: string;

  @Prop()
  url?: string;

  @Prop()
  imageUrl?: string;

  @Prop({ index: true })
  category?: string;
}

export const NewsSchema = SchemaFactory.createForClass(News);
