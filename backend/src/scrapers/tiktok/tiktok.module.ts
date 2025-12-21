import { Module } from '@nestjs/common';
import { TiktokService } from './tiktok.service';

@Module({
  providers: [TiktokService]
})
export class TiktokModule {}
