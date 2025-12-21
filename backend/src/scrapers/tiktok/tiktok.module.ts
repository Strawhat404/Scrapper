import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TiktokService } from './tiktok.service';
import { ScrapedPost } from '../../database/entities/scraped-post.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScrapedPost]),
    ConfigModule,
  ],
  providers: [TiktokService],
  exports: [TiktokService], // Export so we can use it in TestController
})
export class TiktokModule { }