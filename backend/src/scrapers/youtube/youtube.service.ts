import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { YouTube } from 'youtube-sr';
import { ScrapedPost, Platform, MediaType } from '../../database/entities/scraped-post.entity';

@Injectable()
export class YoutubeService {
  constructor(
    @InjectRepository(ScrapedPost)
    private readonly scrapedPostRepository: Repository<ScrapedPost>,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Search YouTube by keyword and save results to database
   */
  async scrapeByKeyword(keyword: string, maxResults: number = 10): Promise<ScrapedPost[]> {
    try {
      console.log(`🔍 Searching YouTube for: "${keyword}"`);

      // 1. Search YouTube
      const videos = await YouTube.search(keyword, { limit: maxResults, type: 'video' });

      if (!videos || videos.length === 0) {
        console.log('❌ No videos found');
        return [];
      }

      console.log(`✅ Found ${videos.length} videos`);

      // 2. Convert to our database format
      const scrapedPosts: ScrapedPost[] = videos.map((video) => {
        const post = new ScrapedPost();
        post.platform = Platform.YOUTUBE;
        post.postId = video.id || '';
        post.authorName = video.channel?.name || 'Unknown';
        post.authorUsername = video.channel?.name || 'Unknown';
        post.content = video.title || '';
        post.mediaType = MediaType.VIDEO;
        post.mediaUrls = video.url ? [video.url] : [];
        post.thumbnailUrl = video.thumbnail?.url || '';
        post.views = video.views || 0;
        post.likes = 0; // youtube-sr doesn't provide likes
        post.comments = 0;
        post.postUrl = video.url || '';
        return post;
      });

      // 3. Save to database
      const savedPosts = await this.scrapedPostRepository.save(scrapedPosts);
      console.log(`💾 Saved ${savedPosts.length} videos to database`);

      // 4. Rate limiting (wait before next scrape)
      await this.sleep(this.getRandomDelay());

      return savedPosts;
    } catch (error) {
      console.error('❌ YouTube scraping error:', error.message);
      throw error;
    }
  }

  /**
   * Get random delay from config (anti-ban measure)
   */
  private getRandomDelay(): number {
    const min = this.configService.get<number>('SCRAPING_DELAY_MIN') || 3000;
    const max = this.configService.get<number>('SCRAPING_DELAY_MAX') || 8000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}