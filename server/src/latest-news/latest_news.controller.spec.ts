import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { LatestNewsController } from './latest_news.controller';
import { LatestNewsService } from './latest_news.service';
import { PublicApiGuard } from '../helper/api_guard';

describe('LatestNewsController', () => {
  let controller: LatestNewsController;
  let service: jest.Mocked<Partial<LatestNewsService>>;

  beforeEach(async () => {
    service = {
      latestKev: jest.fn(),
      latestEuvd: jest.fn(),
      nvdCvss: jest.fn(),
      latestVulnFeed: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LatestNewsController],
      providers: [{ provide: LatestNewsService, useValue: service }],
    })
      .overrideGuard(PublicApiGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(LatestNewsController);
  });

  it('rejects an invalid euvd type', async () => {
    await expect(controller.findEuvd('nonsense' as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(service.latestEuvd).not.toHaveBeenCalled();
  });

  it('rejects a malformed CVE id', async () => {
    service.nvdCvss.mockResolvedValue(null);
    await expect(controller.findNvd('not-a-cve')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('caps the vuln feed limit at 200', async () => {
    service.latestVulnFeed.mockResolvedValue([]);
    await controller.findVulnFeed(9999);
    expect(service.latestVulnFeed).toHaveBeenCalledWith(200);
  });

  it('returns a generic error when the service throws', async () => {
    service.latestKev.mockRejectedValue(new Error('DB_PASSWORD=hunter2'));
    const res = await controller.findKev(50);
    expect(res).toEqual({ error: 'Error fetching KEV catalog' });
    expect(JSON.stringify(res)).not.toContain('hunter2');
  });
});