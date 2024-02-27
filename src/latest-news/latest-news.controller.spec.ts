import { Test, TestingModule } from '@nestjs/testing';
import { LatestNewsController } from './latest-news.controller';
import { LatestNewsService } from './latest-news.service';

describe('LatestNewsController', () => {
  let controller: LatestNewsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LatestNewsController],
      providers: [LatestNewsService],
    }).compile();

    controller = module.get<LatestNewsController>(LatestNewsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
