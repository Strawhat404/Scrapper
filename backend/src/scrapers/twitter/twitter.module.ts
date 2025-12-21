import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TwitterService } from './twitter.service';
import { ScrapedPost } from '../../database/entities/scraped-post.entity';

@Module({
  imports: [
    ConfigModule, // Access to environment variables
    TypeOrmModule.forFeature([ScrapedPost]), // Access to database
  ],
  providers: [TwitterService],
  exports: [TwitterService], // Export so other modules can use it
})
export class TwitterModule { }