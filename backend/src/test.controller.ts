import { Controller, Get, Query } from '@nestjs/common';
import { YoutubeService } from './scrapers/youtube/youtube.service';

@Controller('test')
export class TestController {
    constructor(private readonly youtubeService: YoutubeService) { }

    @Get('youtube')
    async testYoutube(@Query('q') query: string) {
        if (!query) return { error: 'Please provide a query param: ?q=keyword' };
        return await this.youtubeService.scrapeByKeyword(query);
    }
}
