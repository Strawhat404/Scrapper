import { Controller, Get, Query, Delete, Param, HttpStatus, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { YoutubeService } from './scrapers/youtube/youtube.service';
import { TwitterService } from './scrapers/twitter/twitter.service';
import { TiktokService } from './scrapers/tiktok/tiktok.service';
import { InstagramService } from './scrapers/instagram/instagram.service';
import { ScrapedPost } from './database/entities/scraped-post.entity';

@Controller('test')
export class TestController {
    constructor(
        private readonly youtubeService: YoutubeService,
        private readonly twitterService: TwitterService,
        private readonly tiktokService: TiktokService,
        private readonly instagramService: InstagramService,
        @InjectRepository(ScrapedPost)
        private readonly scrapedPostRepository: Repository<ScrapedPost>,
    ) { }

    @Get('youtube')
    async testYoutube(@Query('q') query: string) {
        if (!query) return { error: 'Please provide query param: ?q=keyword' };
        return await this.youtubeService.scrapeByKeyword(query);
    }

    @Get('twitter')
    async testTwitter(@Query('q') query: string) {
        if (!query) return { error: 'Please provide query param: ?q=keyword' };
        return await this.twitterService.scrapeByKeyword(query);
    }

    @Get('tiktok')
    async testTiktok(@Query('q') query: string) {
        if (!query) return { error: 'Please provide query param: ?q=hashtag' };
        return await this.tiktokService.scrapeByHashtag(query);
    }

    @Get('instagram')
    async testInstagram(@Query('url') url: string, @Query('q') hashtag: string) {
        // If URL is provided, scrape single post
        if (url) {
            return await this.instagramService.scrapePost(url);
        }
        
        // If hashtag is provided, scrape by hashtag (mass scraping)
        if (hashtag) {
            return await this.instagramService.scrapeByHashtag(hashtag);
        }
        
        // If neither provided, show error
        return { 
            error: 'Please provide either url or q param',
            examples: {
                single_post: '?url=https://www.instagram.com/p/CtjoC2BNsB2/',
                hashtag: '?q=cats'
            }
        };
    }

    @Get('instagram/multiple')
    async testInstagramMultiple(@Query('urls') urls: string) {
        if (!urls) {
            return { 
                error: 'Please provide urls param (comma-separated)',
                example: '?urls=https://www.instagram.com/p/ABC123/,https://www.instagram.com/p/DEF456/'
            };
        }
        const urlArray = urls.split(',').map(u => u.trim());
        return await this.instagramService.scrapeMultiplePosts(urlArray);
    }

    // NEW ENDPOINT: Get all scraped posts from database
    @Get('posts')
    async getAllPosts(
        @Query('limit') limit?: string,
        @Query('platform') platform?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const queryBuilder = this.scrapedPostRepository
            .createQueryBuilder('post')
            .orderBy('post.scrapedAt', 'DESC');

        // Filter by platform if provided
        if (platform) {
            queryBuilder.where('LOWER(post.platform::text) = LOWER(:platform)', { platform });
        }

        // Filter by date range if provided
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0); // Start of day
            queryBuilder.andWhere('post.scrapedAt >= :startDate', { startDate: start });
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // End of day
            queryBuilder.andWhere('post.scrapedAt <= :endDate', { endDate: end });
        }

        // Limit results (default 50)
        const limitNum = limit ? parseInt(limit) : 50;
        queryBuilder.limit(limitNum);

        const posts = await queryBuilder.getMany();
        
        return {
            total: posts.length,
            posts: posts,
        };
    }

    // NEW ENDPOINT: Get statistics
    @Get('stats')
    async getStats() {
        const total = await this.scrapedPostRepository.count();
        
        // Get today's date at midnight
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const byPlatform = await this.scrapedPostRepository
            .createQueryBuilder('post')
            .select('post.platform', 'platform')
            .addSelect('COUNT(*)', 'totalCount')
            .addSelect(
                `COUNT(CASE WHEN post.scrapedAt >= :today THEN 1 END)`,
                'todayCount'
            )
            .addSelect('MAX(post.scrapedAt)', 'lastCrawl')
            .setParameter('today', today)
            .groupBy('post.platform')
            .getRawMany();

        return {
            totalPosts: total,
            byPlatform: byPlatform,
        };
    }

    @Get('dashboard/stats')
    async getDashboardStats() {
  // Total posts scraped
      const totalPosts = await this.scrapedPostRepository.count();
  
  // Posts by platform
      const byPlatform = await this.scrapedPostRepository
        .createQueryBuilder('post')
        .select('post.platform', 'platform')
        .addSelect('COUNT(*)', 'count')
        .groupBy('post.platform')
        .getRawMany();
  
  // Posts scraped today
      const today = new Date();
        today.setHours(0, 0, 0, 0);
  
      const postsToday = await this.scrapedPostRepository
        .createQueryBuilder('post')
        .where('post.scrapedAt >= :today', { today })
        .getCount();
  
  // Calculate success rate (for now, we'll use a simple metric)
  // In a real app, you'd track failed scraping attempts
     const successRate = totalPosts > 0 ? 94.2 : 0;
  
     return {
        totalPosts,
        postsToday,
        activeCrawls: 0, // You'll implement this when you add job tracking
        processingQueue: 0, // You'll implement this when you add job queue
        successRate,
        byPlatform,
  };
}
@Get('dashboard/volume')
async getVolumeData(@Query('days') days?: string) {
  const numDays = days ? parseInt(days) : 7;
  
  // Calculate the date N days ago in JavaScript (works with all databases)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - numDays);
  
  // Get posts grouped by day for the last N days
  const volumeData = await this.scrapedPostRepository
    .createQueryBuilder('post')
    .select("DATE(post.scrapedAt)", 'date')
    .addSelect('COUNT(*)', 'count')
    .where('post.scrapedAt >= :startDate', { startDate })
    .groupBy('DATE(post.scrapedAt)')
    .orderBy('DATE(post.scrapedAt)', 'ASC')
    .getRawMany();
  
  // Format for the chart
  const formattedData = volumeData.map(item => ({
    date: item.date,
    posts: parseInt(item.count),
  }));
  
  return formattedData;
}

    // DELETE endpoint: Delete a post by ID
    @Delete('posts/:id')
    async deletePost(@Param('id') id: string) {
        try {
            console.log('Attempting to delete post with ID:', id);
            const result = await this.scrapedPostRepository.delete(id);
            console.log('Delete result:', result);
            
            if (result.affected === 0) {
                throw new HttpException('Post not found', HttpStatus.NOT_FOUND);
            }
            
            return { 
                success: true, 
                message: 'Post deleted successfully',
                deletedId: id
            };
        } catch (error) {
            console.error('Error deleting post:', error);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException('Failed to delete post', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }


}
