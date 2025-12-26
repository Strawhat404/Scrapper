import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PlaywrightCrawler } from '@crawlee/playwright';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ScrapedPost, Platform, MediaType } from '../../database/entities/scraped-post.entity';

// Add stealth plugin to Playwright
chromium.use(StealthPlugin());

@Injectable()
export class TwitterService {
    private readonly logger = new Logger(TwitterService.name);

    constructor(
        @InjectRepository(ScrapedPost)
        private readonly scrapedPostRepository: Repository<ScrapedPost>,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Scrape Twitter via Nitter (undetectable & no login)
     */
    async scrapeByKeyword(keyword: string, maxResults: number = 10): Promise<ScrapedPost[]> {
        this.logger.log(`🚀 Twitter scraper called with keyword: ${keyword}, maxResults: ${maxResults}`);
        
        const scrapedPosts: ScrapedPost[] = [];

        // Nitter instances (can rotate these if one is down)
        const nitterInstances = [
            'https://nitter.net',
            'https://nitter.cz',
            'https://nitter.privacydev.net',
        ];
        // Pick a random instance to distribute load
        const baseUrl = nitterInstances[Math.floor(Math.random() * nitterInstances.length)];

        try {
            this.logger.log(`🐦 Searching via Nitter (${baseUrl}) for: "${keyword}"`);

            const crawler = new PlaywrightCrawler({
                launchContext: {
                    launcher: chromium,
                    launchOptions: {
                        // Keep headless: true for Nitter as it's much harder to detect
                        headless: false,
                        args: ['--no-sandbox', '--disable-setuid-sandbox'],
                    },
                },
                maxRequestsPerCrawl: 1,
                requestHandler: async ({ page }) => {
                    this.logger.log(`📄 Loading Nitter search page...`);

                    try {
                        // Wait for timeline items
                        this.logger.log(`⏳ Waiting for .timeline-item selector...`);
                        await page.waitForSelector('.timeline-item', { timeout: 10000 });
                        this.logger.log(`✅ Timeline items found`);

                        // Extract tweet data using Nitter's simple selectors
                        const tweets = await page.$$eval('.timeline-item', (items, max) => {
                            return items
                                .filter(item => !item.classList.contains('show-more')) // Ignore "Load more" buttons
                                .slice(0, max)
                                .map((item) => {
                                    try {
                                        // Extract Author
                                        const fullName = item.querySelector('.fullname')?.textContent?.trim() || 'Unknown';
                                        const username = item.querySelector('.username')?.textContent?.trim() || 'Unknown';

                                        // Extract Content
                                        const content = item.querySelector('.tweet-content')?.textContent?.trim() || '';

                                        // Extract URL & ID
                                        const linkElement = item.querySelector('.tweet-link') as HTMLAnchorElement;
                                        const relativeUrl = linkElement?.getAttribute('href') || '';
                                        const postUrl = relativeUrl ? `https://twitter.com${relativeUrl.replace('#m', '')}` : '';

                                        // Extract ID from URL (e.g. /user/status/123456)
                                        // Nitter URL format: /Username/status/1234567890#m
                                        const postId = relativeUrl.match(/status\/(\d+)/)?.[1] || '';

                                        // Extract Stats
                                        const stats = item.querySelectorAll('.tweet-stat .icon-container');
                                        // Usually: [Comments, Retweets, Quotes, Likes]
                                        const comments = parseInt(stats[0]?.nextSibling?.textContent?.trim().replace(/,/g, '') || '0');
                                        const likes = parseInt(stats[3]?.nextSibling?.textContent?.trim().replace(/,/g, '') || '0');

                                        return {
                                            authorName: fullName,
                                            authorUsername: username,
                                            content,
                                            postUrl,
                                            postId,
                                            comments,
                                            likes,
                                        };
                                    } catch (err) {
                                        return null;
                                    }
                                })
                                .filter(Boolean);
                        }, maxResults);

                        this.logger.log(`✅ Extracted ${tweets.length} tweets from Nitter`);

                        // Convert to ScrapedPost entities
                        tweets.forEach((tweet: any) => {
                            const post = new ScrapedPost();
                            post.platform = Platform.TWITTER;
                            post.postId = tweet.postId;
                            post.authorName = tweet.authorName;
                            post.authorUsername = tweet.authorUsername;
                            post.content = tweet.content;
                            post.mediaType = MediaType.TEXT; // Simplification for now
                            post.mediaUrls = [];
                            post.postUrl = tweet.postUrl;
                            post.likes = tweet.likes;
                            post.views = 0; // Nitter doesn't always show views
                            post.comments = tweet.comments;
                            scrapedPosts.push(post);
                        });
                    } catch (pageError) {
                        this.logger.error(`❌ Error extracting tweets from page: ${pageError.message}`);
                        this.logger.error(`❌ Stack trace: ${pageError.stack}`);
                        throw pageError;
                    }
                },
            });

            // Nitter search URL format
            const searchUrl = `${baseUrl}/search?f=tweets&q=${encodeURIComponent(keyword)}`;
            await crawler.run([searchUrl]);

            if (scrapedPosts.length > 0) {
                const savedPosts = await this.scrapedPostRepository.save(scrapedPosts);
                this.logger.log(`💾 Saved ${savedPosts.length} tweets to database`);
                return savedPosts;
            }

            this.logger.warn('⚠️ No tweets found on Nitter');
            return [];

        } catch (error) {
            this.logger.error(`❌ Nitter scraping error: ${error.message}`);
            this.logger.error(`❌ Stack trace: ${error.stack}`);
            this.logger.error(`💡 Possible reasons: Nitter instance down, network issue, or selector changes`);
            return []; // Return empty array instead of crashing
        }
    }

    /**
     * Get random delay from config (anti-ban measure)
     */
    private getRandomDelay(): number {
        const min = this.configService.get<number>('SCRAPING_DELAY_MIN') || 3000;
        const max = this.configService.get<number>('SCRAPING_DELAY_MAX') || 5000;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
