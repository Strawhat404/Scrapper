import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ScrapedPost, Platform, MediaType } from '../../database/entities/scraped-post.entity';

// Enable stealth mode
chromium.use(StealthPlugin());


@Injectable()
export class TiktokService {
    private readonly logger = new Logger(TiktokService.name);

    constructor(
        @InjectRepository(ScrapedPost)
        private readonly scrapedPostRepository: Repository<ScrapedPost>,
        private readonly configService: ConfigService,
    ) { }

    async scrapeByHashtag(hashtag: string, maxResults: number = 10): Promise<ScrapedPost[]> {
        const scrapedPosts: ScrapedPost[] = [];
        const tag = hashtag.replace('#', '');
        const url = `https://www.tiktok.com/tag/${tag}`;

        this.logger.log(`🎵 Launching Secure Browser for: #${tag}`);

        // Launch a REAL browser to handle all the signing/cookies for us
        const browser = await chromium.launch({
            headless: false,
            args: ['--disable-blink-features=AutomationControlled']
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        });

        const page = await context.newPage();

        try {
            let capturedData: any = null;

            // 1. Listen for the exact API response we need
            // This captures the raw JSON directly from TikTok's internal calls
            page.on('response', async (response) => {
                const resUrl = response.url();
                if (resUrl.includes('/api/challenge/item_list') || resUrl.includes('/api/search/item')) {
                    try {
                        const json = await response.json();
                        if (json.itemList || json.item_list) {
                            capturedData = json;
                            this.logger.log(`📥 Data intercepted from network!`);
                        }
                    } catch (e) { /* ignore parse errors */ }
                }
            });

            // 2. Open the page
            await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

            // 3. Wait for data or Human to solve Captcha
            this.logger.log('⏳ Waiting for data... Solve Captcha if it appears!');

            let timeoutSeconds = 60;
            while (!capturedData && timeoutSeconds > 0) {
                // Check if captcha is on screen to alert the user
                const isCaptcha = await page.$('.captcha-disable-scroll') || await page.$('#captcha_container');
                if (isCaptcha) {
                    this.logger.warn(`🚨 CAPTCHA DETECTED! Use the open browser window to solve it.`);
                }

                await new Promise(r => setTimeout(r, 1000));
                timeoutSeconds--;
            }

            if (!capturedData) {
                this.logger.error('❌ Failed to capture data after 60 seconds.');
                return [];
            }

            // 4. Parse the Captured JSON
            const videos = capturedData.itemList || capturedData.item_list || [];
            this.logger.log(`✅ Extracted ${videos.length} videos from intercepted data`);

            for (const v of videos) {
                const post = new ScrapedPost();
                post.platform = Platform.TIKTOK;
                post.postId = v.id || v.video?.id;
                post.authorUsername = v.author?.uniqueId || v.author?.unique_id || 'unknown';
                post.authorName = v.author?.nickname || 'unknown';
                post.content = v.desc || '';
                post.postUrl = `https://www.tiktok.com/@${post.authorUsername}/video/${post.postId}`;
                post.likes = v.stats?.diggCount || v.stats?.digg_count || 0;
                post.comments = v.stats?.commentCount || v.stats?.comment_count || 0;
                post.views = v.stats?.playCount || v.stats?.play_count || 0;
                post.mediaType = MediaType.VIDEO;

                scrapedPosts.push(post);
            }

            if (scrapedPosts.length > 0) {
                // Return up to maxResults
                const results = scrapedPosts.slice(0, maxResults);
                return await this.scrapedPostRepository.save(results);
            }
            return [];

        } catch (error) {
            this.logger.error(`❌ Browser Error: ${error.message}`);
            return [];
        } finally {
            // Give it a second to finish any DB saves then close
            await new Promise(r => setTimeout(r, 2000));
            await browser.close();
        }
    }

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}