import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ScrapedPost, Platform, MediaType } from '../../database/entities/scraped-post.entity';
import { SharedBrowserService } from '../shared-browser.service';
import { BrightDataService } from '../brightdata.service';
import * as cheerio from 'cheerio';

@Injectable()
export class TiktokService {
    private readonly logger = new Logger(TiktokService.name);

    constructor(
        @InjectRepository(ScrapedPost)
        private readonly scrapedPostRepository: Repository<ScrapedPost>,
        private readonly configService: ConfigService,
        private readonly sharedBrowser: SharedBrowserService,
        private readonly brightData: BrightDataService,
    ) { }

    async scrapeByHashtag(hashtag: string, maxResults: number = 10, useProxy: boolean = true): Promise<ScrapedPost[]> {
        this.logger.log(`🚀 TikTok scraper called with hashtag: ${hashtag}, maxResults: ${maxResults}, useProxy: ${useProxy}`);
        
        const scrapedPosts: ScrapedPost[] = [];
        const tag = hashtag.replace('#', '');
        const url = `https://www.tiktok.com/tag/${tag}`;

        let context: any = null;
        let page: any = null;

        try {
            this.logger.log(`🎵 Opening TikTok with BrightData proxy for: #${tag}`);
            
            // Get browser with proxy configuration (HEADLESS - no visible browser)
            const browser = await this.sharedBrowser.getBrowser(true); // Headless mode
            
            // Create context with BrightData proxy
            const proxyConfig = this.brightData.getProxyConfig();
            context = await browser.newContext({
                proxy: useProxy ? proxyConfig : undefined,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            });
            
            page = await context.newPage();
            this.logger.log(`✅ New tab created with proxy`);

            let capturedData: any = null;

            // Listen for API responses
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

            // Navigate to page
            this.logger.log(`🌐 Navigating to: ${url}`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            this.logger.log(`✅ Page loaded`);

            // Wait 10 seconds for error message to appear
            this.logger.log('⏳ Waiting 10 seconds for page to fully load or error...');
            await this.sleep(10000);

            // Check for refresh button and click it
            this.logger.log('🔍 Checking for refresh button...');
            
            try {
                const refreshButton = await page.$('button:has-text("Refresh")') || 
                                     await page.$('button:has-text("refresh")') ||
                                     await page.$('[data-e2e="refresh-button"]');
                
                if (refreshButton) {
                    this.logger.log('🔄 Refresh button found, clicking...');
                    await refreshButton.click();
                    this.logger.log('⏳ Waiting 10 seconds after refresh...');
                    await this.sleep(10000); // Wait 10 seconds after refresh
                    this.logger.log('✅ Page refreshed');
                } else {
                    this.logger.log('✅ No refresh button needed');
                }
            } catch (e) {
                this.logger.log('✅ No refresh button');
            }

            // Simulate human behavior AFTER refresh
            this.logger.log('🤖 Simulating human behavior...');
            await page.mouse.move(100, 100);
            await this.sleep(300);
            await page.mouse.move(250, 350);
            await this.sleep(500);
            
            // Scroll down slowly
            for (let i = 0; i < 3; i++) {
                await page.mouse.wheel(0, 400);
                await this.sleep(1200);
            }
            this.logger.log('✅ Human behavior simulated');

            // Wait for data with longer timeout
            this.logger.log('⏳ Waiting for data...');
            let timeoutSeconds = 45;

            while (!capturedData && timeoutSeconds > 0) {
                // Check for CAPTCHA
                const isCaptcha = await page.$('.captcha-disable-scroll') || await page.$('#captcha_container');
                if (isCaptcha) {
                    this.logger.warn(`🚨 CAPTCHA DETECTED! Waiting...`);
                    await this.sleep(2000);
                    timeoutSeconds -= 2;
                    continue;
                }

                // If we have data, break immediately
                if (capturedData) {
                    this.logger.log('✅ Data captured, processing...');
                    break;
                }

                await this.sleep(1000);
                timeoutSeconds--;
            }

            if (!capturedData) {
                this.logger.error('❌ Failed to capture data after 45 seconds.');
                return [];
            }

            // Parse captured data
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
                const results = scrapedPosts.slice(0, maxResults);
                this.logger.log(`💾 Saving ${results.length} posts to database...`);
                const saved = await this.scrapedPostRepository.save(results);
                this.logger.log(`✅ Successfully saved ${saved.length} posts`);
                return saved;
            }
            
            this.logger.warn('⚠️ No posts to save');
            return [];

        } catch (error) {
            this.logger.error(`❌ Browser Error: ${error.message}`);
            this.logger.error(`❌ Stack trace: ${error.stack}`);
            return [];
        } finally {
            if (context) {
                this.logger.log('🧹 Closing TikTok tab...');
                try {
                    await new Promise(r => setTimeout(r, 2000));
                    await context.close();
                    this.logger.log('✅ TikTok tab closed');
                } catch (closeError) {
                    this.logger.error(`⚠️ Error closing tab: ${closeError.message}`);
                }
            }
        }
    }

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
