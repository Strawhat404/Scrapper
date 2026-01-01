import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { InstagramService } from './instagram.service';
import { ScrapedPost } from '../../database/entities/scraped-post.entity';
import { BrightDataService } from '../brightdata.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ScrapedPost]),
  ],
  providers: [InstagramService, BrightDataService],
  exports: [InstagramService],
})
export class InstagramModule { }