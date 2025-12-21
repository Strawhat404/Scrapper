import { Test, TestingModule } from '@nestjs/testing';
import { TiktokService } from './tiktok.service';

describe('TiktokService', () => {
  let service: TiktokService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TiktokService],
    }).compile();

    service = module.get<TiktokService>(TiktokService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
