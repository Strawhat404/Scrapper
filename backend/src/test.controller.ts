import { Controller, Get, Query } from '@nestjs/common';
import { YoutubeService } from './scrapers/youtube/youtube.service';
import { TwitterService } from './scrapers/twitter/twitter.service';

@Controller('test')
export class TestController {
    constructor(
        private readonly youtubeService: YoutubeService,
        private readonly twitterService: TwitterService,
    ) { }

    @Get('youtube')
    async testYoutube(@Query('q') query: string) {
        if (!query) return { error: 'Please provide a query param: ?q=keyword' };
        return await this.youtubeService.scrapeByKeyword(query);
    }

    @Get('twitter')
    async testTwitter(@Query('q') query: string) {
        if (!query) return { error: 'Please provide a query param: ?q=keyword' };
        return await this.twitterService.scrapeByKeyword(query);
    }
}