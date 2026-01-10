import { Test, TestingModule } from '@nestjs/testing';
import { HistoryResolver } from './history.resolver';
import { HistoryService } from './history.service';

describe('HistoryResolver', () => {
  let resolver: HistoryResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HistoryResolver, HistoryService],
    }).compile();

    resolver = module.get<HistoryResolver>(HistoryResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
