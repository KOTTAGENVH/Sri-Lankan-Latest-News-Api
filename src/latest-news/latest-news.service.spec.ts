import { Test, TestingModule } from '@nestjs/testing';
import { LatestNewsService } from './latest-news.service';

describe('LatestNewsService', () => {
  let service: LatestNewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LatestNewsService],
    }).compile();

    service = module.get<LatestNewsService>(LatestNewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
