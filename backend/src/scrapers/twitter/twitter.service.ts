import { Injectable } from '@nestjs/common';
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
    constructor(
        @InjectRepository(ScrapedPost)
        private readonly scrapedPostRepository: Repository<ScrapedPost>,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Scrape Twitter by keyword (public search, no login required)
     */
    async scrapeByKeyword(keyword: string, maxResults: number = 10): Promise<ScrapedPost[]> {
        const scrapedPosts: ScrapedPost[] = [];

        try {
            console.log(`🐦 Searching Twitter for: "${keyword}"`);

            // Configure Crawlee with stealth Playwright
            const crawler = new PlaywrightCrawler({
                launchContext: {
                    launcher: chromium, // Use stealth-enhanced Chromium
                    launchOptions: {
                        headless: true, // Run in background
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-blink-features=AutomationControlled', // Hide automation
                        ],
                    },
                },
                maxRequestsPerCrawl: 1, // Only visit the search page once
                requestHandler: async ({ page, request }) => {
                    console.log(`📄 Loading Twitter search page...`);

                    // Wait for tweets to load
                    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 });

                    // Extract tweet data
                    const tweets = await page.$$eval('article[data-testid="tweet"]', (articles, max) => {
                        return articles.slice(0, max).map((article) => {
                            try {
                                // Extract author name
                                const authorElement = article.querySelector('[data-testid="User-Name"] span');
                                const authorName = authorElement?.textContent?.trim() || 'Unknown';

                                // Extract tweet text
                                const tweetTextElement = article.querySelector('[data-testid="tweetText"]');
                                const content = tweetTextElement?.textContent?.trim() || '';

                                // Extract tweet URL
                                const linkElement = article.querySelector('a[href*="/status/"]');
                                const postUrl = linkElement ? `https://twitter.com${linkElement.getAttribute('href')}` : '';

                                // Extract post ID from URL
                                const postId = postUrl.match(/status\/(\d+)/)?.[1] || '';

                                return {
                                    authorName,
                                    content,
                                    postUrl,
                                    postId,
                                };
                            } catch (err) {
                                console.error('Error parsing tweet:', err);
                                return null;
                            }
                        }).filter(Boolean); // Remove null entries
                    }, maxResults);

                    console.log(`✅ Extracted ${tweets.length} tweets`);

                    // Convert to ScrapedPost entities
                    tweets.forEach((tweet: any) => {
                        const post = new ScrapedPost();
                        post.platform = Platform.TWITTER;
                        post.postId = tweet.postId;
                        post.authorName = tweet.authorName;
                        post.authorUsername = tweet.authorName; // Twitter doesn't expose username in search
                        post.content = tweet.content;
                        post.mediaType = MediaType.TEXT;
                        post.mediaUrls = [];
                        post.postUrl = tweet.postUrl;
                        post.likes = 0; // Not available without login
                        post.views = 0;
                        post.comments = 0;
                        scrapedPosts.push(post);
                    });
                },
            });

            // Start crawling Twitter search
            const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(keyword)}&src=typed_query&f=live`;
            await crawler.run([searchUrl]);

            // Save to database
            if (scrapedPosts.length > 0) {
                const savedPosts = await this.scrapedPostRepository.save(scrapedPosts);
                console.log(`💾 Saved ${savedPosts.length} tweets to database`);

                // Rate limiting (anti-ban measure)
                await this.sleep(this.getRandomDelay());

                return savedPosts;
            }

            console.log('❌ No tweets found');
            return [];
        } catch (error) {
            console.error('❌ Twitter scraping error:', error.message);
            throw error;
        }
    }

    /**
     * Get random delay from config (anti-ban measure)
     */
    private getRandomDelay(): number {
        const min = this.configService.get<number>('SCRAPING_DELAY_MIN') || 5000;
        const max = this.configService.get<number>('SCRAPING_DELAY_MAX') || 15000;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}