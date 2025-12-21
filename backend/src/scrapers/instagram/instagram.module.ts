import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstagramService } from './instagram.service';
import { ScrapedPost } from '../../database/entities/scraped-post.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ScrapedPost])],
  providers: [InstagramService],
  exports: [InstagramService],
})
export class InstagramModule { }