import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ScrapedPost, Platform, MediaType } from '../../database/entities/scraped-post.entity';

chromium.use(StealthPlugin());

@Injectable()
export class InstagramService {
    private readonly logger = new Logger(InstagramService.name);

    constructor(
        @InjectRepository(ScrapedPost)
        private readonly scrapedPostRepository: Repository<ScrapedPost>,
    ) { }

    async scrapeByHashtag(hashtag: string, maxResults: number = 10): Promise<ScrapedPost[]> {
        const tag = hashtag.replace('#', '');
        const url = `https://www.instagram.com/explore/tags/${tag}/`;
        const scrapedPosts: ScrapedPost[] = [];

        this.logger.log(`📸 Launching Instagram Browser for: #${tag}`);

        const browser = await chromium.launch({
            headless: false,
            args: ['--disable-blink-features=AutomationControlled'] // Add this!
        });
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            let interceptedData: any = null;

            // Listen for the "sections" API which contains the post data
            page.on('response', async (response) => {
                const resUrl = response.url();
                if (resUrl.includes('/api/v1/tags/') && resUrl.includes('/sections/')) {
                    try {
                        const json = await response.json();
                        interceptedData = json;
                        this.logger.log('📥 Instagram data intercepted!');
                    } catch (e) { }
                }
            });

            await page.goto(url, { waitUntil: 'networkidle' });

            // Wait up to 30s for the user to solve any "Login Wall" or Captcha
            this.logger.log('⏳ Waiting for data... Solve any login/captcha if they appear!');

            let waitTime = 30;
            while (!interceptedData && waitTime > 0) {
                await new Promise(r => setTimeout(r, 1000));
                waitTime--;
            }

            if (!interceptedData) {
                this.logger.error('❌ Failed to capture Instagram data.');
                return [];
            }

            // Parse Instagram's complex nested JSON
            const sections = interceptedData.sections || [];
            for (const section of sections) {
                const layoutContent = section.layout_content;
                const medias = layoutContent?.medias || [];

                for (const m of medias) {
                    const media = m.media;
                    if (!media || scrapedPosts.length >= maxResults) continue;

                    const post = new ScrapedPost();
                    post.platform = Platform.INSTAGRAM;
                    post.postId = media.pk || media.id;
                    post.authorUsername = media.user?.username || 'unknown';
                    post.authorName = media.user?.full_name || 'unknown';
                    post.content = media.caption?.text || '';
                    post.postUrl = `https://www.instagram.com/p/${media.code}/`;
                    post.likes = media.like_count || 0;
                    post.comments = media.comment_count || 0;
                    post.views = media.view_count || 0;
                    post.mediaType = media.media_type === 2 ? MediaType.VIDEO : MediaType.IMAGE;

                    scrapedPosts.push(post);
                }
            }

            this.logger.log(`✅ Extracted ${scrapedPosts.length} Instagram posts`);
            return await this.scrapedPostRepository.save(scrapedPosts);

        } catch (error) {
            this.logger.error(`❌ Instagram Error: ${error.message}`);
            return [];
        } finally {
            await browser.close();
        }
    }
}