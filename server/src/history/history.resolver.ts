import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { HistoryService } from './history.service';
import { History } from './entities/history.entity';
// import { SemanticSearchResult } from './entities/sematic_search.entity';

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
  //Uncommend if embedding server is self hosted
  // @Query(() => [SemanticSearchResult])
  // semanticSearch(
  //   @Args('text') text: string,
  //   @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number,
  // ) {
  //   const safeLimit = Math.min(limit, 50);

  //   return this.historyService.sematicSearchByQuery(text, safeLimit);
  // }

  @Query(() => [History])
  atlasSearch(
    @Args('text') text: string,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number,
  ) {
    const safeLimit = Math.min(limit, 50);

    return this.historyService.atlasSearchByQuery(text, safeLimit);
  }
}
