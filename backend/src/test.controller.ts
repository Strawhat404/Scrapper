import { Controller, Get, Query } from '@nestjs/common';
import { YoutubeService } from './scrapers/youtube/youtube.service';
import { TwitterService } from './scrapers/twitter/twitter.service';
import { TiktokService } from './scrapers/tiktok/tiktok.service';
import { InstagramService } from './scrapers/instagram/instagram.service'; // 1. Add this

@Controller('test')
export class TestController {
    constructor(
        private readonly youtubeService: YoutubeService,
        private readonly twitterService: TwitterService,
        private readonly tiktokService: TiktokService,
        private readonly instagramService: InstagramService, // 2. Add this
    ) { }

    // ... your existing endpoints ...

    @Get('instagram') // 3. Add this endpoint
    async testInstagram(@Query('q') query: string) {
        if (!query) return { error: 'Please provide query param: ?q=tag' };
        return await this.instagramService.scrapeByHashtag(query);
    }
}