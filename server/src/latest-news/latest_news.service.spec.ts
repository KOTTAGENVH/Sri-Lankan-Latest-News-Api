import { Test, TestingModule } from '@nestjs/testing';
import { LatestNewsService } from './latest_news.service';
import { CacheModule } from '../cache/cache.module';

jest.setTimeout(20000);

describe('LatestNewsService', () => {
  let service: LatestNewsService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.forRoot({ ttl: 1, max: 10, sweepIntervalMs: 0 })],
      providers: [LatestNewsService],
    }).compile();

    service = module.get(LatestNewsService);
  });

  it('Lankadeepa returns articles', async () => {
    const result = await service.latestLankadeepa(1);
    expect(Array.isArray(result)).toBe(true);
  });

  it('BBC Sinhala returns articles', async () => {
    const result = await service.latestBBCSinhala(1);
    expect(Array.isArray(result)).toBe(true);
  });

  it('NewsFirst Tamil returns data', async () => {
    const result = await service.latestNewsFirstTamil();
    expect(result).toHaveProperty('latest');
  });

  it('NewsWire returns data', async () => {
    const result = await service.latestNewsWire();
    expect(result).toHaveProperty('latest');
  });

  it('AdaDerana returns data', async () => {
    const result = await service.latestAdaDerana();
    expect(result).toHaveProperty('lead_story');
  });
});
