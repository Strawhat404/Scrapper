import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { YoutubeService } from './youtube.service';
import { ScrapedPost } from '../../database/entities/scraped-post.entity';

@Module({
  imports: [
    ConfigModule, // Add this - gives access to ConfigService
    TypeOrmModule.forFeature([ScrapedPost]),
  ],
  providers: [YoutubeService],
  exports: [YoutubeService],
})
export class YoutubeModule { }