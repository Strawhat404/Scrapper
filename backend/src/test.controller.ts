import { Controller, Get, Query } from '@nestjs/common';
import { YoutubeService } from './scrapers/youtube/youtube.service';
import { TwitterService } from './scrapers/twitter/twitter.service';
import { TiktokService } from './scrapers/tiktok/tiktok.service';
import { InstagramService } from './scrapers/instagram/instagram.service';

@Controller('test')
export class TestController {
    constructor(
        private readonly youtubeService: YoutubeService,
        private readonly twitterService: TwitterService,
        private readonly tiktokService: TiktokService,
        private readonly instagramService: InstagramService,
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
}
