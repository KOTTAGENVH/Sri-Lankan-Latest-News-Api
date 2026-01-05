import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { HistoryService } from './history.service';
import { History } from './entities/history.entity';

@Resolver(() => History)
export class HistoryResolver {
  constructor(private readonly historyService: HistoryService) {}

  @Query(() => [History])
  history(@Args('page', { type: () => Int, defaultValue: 1 }) page: number) {
    return this.historyService.getAllNews(page);
  }

  @Query(() => [History])
  historyBySource(
    @Args('source', { type: () => Int }) source: number,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
  ) {
    return this.historyService.getNewsBySource(source, page);
  }

  @Query(() => [History])
  newsByDate(
    @Args('date', { type: () => Date }) date: Date,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
  ) {
    return this.historyService.getNewsbyDate(date, page);
  }
}
