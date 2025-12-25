import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { FacebookService } from './facebook.service';
import { ScrapedPost } from '../../database/entities/scraped-post.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ScrapedPost]),
  ],
  providers: [FacebookService],
  exports: [FacebookService],
})

export class FacebookModule {}