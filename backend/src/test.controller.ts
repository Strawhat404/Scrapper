import { Controller, Get, Query } from '@nestjs/common';
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
    ) {
        const queryBuilder = this.scrapedPostRepository
            .createQueryBuilder('post')
            .orderBy('post.createdAt', 'DESC');

        // Filter by platform if provided
        if (platform) {
            queryBuilder.where('LOWER(post.platform::text) = LOWER(:platform)', { platform });

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
        
        const byPlatform = await this.scrapedPostRepository
            .createQueryBuilder('post')
            .select('post.platform', 'platform')
            .addSelect('COUNT(*)', 'count')
            .groupBy('post.platform')
            .getRawMany();

        return {
            totalPosts: total,
            byPlatform: byPlatform,
        };
    }
}
