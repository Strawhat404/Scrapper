import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ScrapedPost, Platform, MediaType } from '../../database/entities/scraped-post.entity';
import { SharedBrowserService } from '../shared-browser.service';
import { BrightDataService } from '../brightdata.service';

@Injectable()
export class FacebookService {
    private readonly logger = new Logger(FacebookService.name);

    constructor(
        @InjectRepository(ScrapedPost)
        private readonly scrapedPostRepository: Repository<ScrapedPost>,
        private readonly configService: ConfigService,
        private readonly sharedBrowser: SharedBrowserService,
        private readonly brightDataService: BrightDataService,
    ) {
        this.logger.log(`✅ Facebook Scraper initialized (Playwright + Residential Proxy)`);
    }

    /**
     * Clean page name - remove @ symbol if present
     */
    private cleanPageName(pageName: string): string {
        return pageName.replace(/^@/, '').trim();
    }

    /**
     * Scrape posts from a Facebook page using Playwright
     */
    async scrapeByUsername(pageName: string, maxPosts: number = 12): Promise<ScrapedPost[]> {
        const cleanedPageName = this.cleanPageName(pageName);
        this.logger.log(`🔍 Scraping Facebook page with Playwright: ${cleanedPageName}`);

        const scrapedPosts: ScrapedPost[] = [];
        const url = `https://www.facebook.com/${cleanedPageName}`;

        let context: any = null;
        let page: any = null;

        try {
            this.logger.log(`📘 Opening Facebook with BrightData proxy for: ${cleanedPageName}`);
            
            // Get browser with proxy configuration
            const browser = await this.sharedBrowser.getBrowser(true); // Always headless for VPS
            
            // Create context with BrightData proxy
            const proxyConfig = this.brightDataService.getProxyConfig();
            context = await browser.newContext({
                proxy: proxyConfig,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            });
            
            page = await context.newPage();
            this.logger.log(`✅ New tab created with proxy`);

            // Navigate to page
            this.logger.log(`🌐 Navigating to: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
            this.logger.log(`✅ Page loaded successfully`);

            // Wait for content to load
            await page.waitForTimeout(5000);

            // Try to extract posts from the page
            const posts = await page.evaluate(({ pageName, maxPosts }: { pageName: string; maxPosts: number }) => {
                const results: any[] = [];
                
                // Facebook uses various selectors for posts
                // Try multiple selectors as Facebook's structure changes frequently
                const postSelectors = [
                    '[data-pagelet^="FeedUnit"]',
                    '[role="article"]',
                    '[data-ad-preview="message"]',
                    '.userContentWrapper',
                ];

                let postElements: Element[] = [];
                for (const selector of postSelectors) {
                    const elements = Array.from(document.querySelectorAll(selector));
                    if (elements.length > 0) {
                        postElements = elements;
                        break;
                    }
                }

                if (postElements.length === 0) {
                    return results;
                }

                for (let i = 0; i < Math.min(postElements.length, maxPosts); i++) {
                    const element = postElements[i];
                    
                    try {
                        // Extract text content
                        const textElement = element.querySelector('[data-ad-comet-preview="message"]') ||
                                          element.querySelector('[data-ad-preview="message"]') ||
                                          element.querySelector('.userContent') ||
                                          element.querySelector('[dir="auto"]');
                        
                        const content = textElement?.textContent?.trim() || '';

                        // Extract post URL
                        const linkElement = element.querySelector('a[href*="/posts/"]') ||
                                          element.querySelector('a[href*="/photos/"]') ||
                                          element.querySelector('a[href*="/videos/"]');
                        
                        let postUrl = linkElement?.getAttribute('href') || '';
                        if (postUrl && !postUrl.startsWith('http')) {
                            postUrl = 'https://www.facebook.com' + postUrl;
                        }

                        // Extract images
                        const images = Array.from(element.querySelectorAll('img'))
                            .map(img => img.src)
                            .filter(src => src && !src.includes('emoji') && !src.includes('static'));

                        // Extract engagement metrics (if visible)
                        const likeElement = element.querySelector('[aria-label*="like"]') ||
                                          element.querySelector('[aria-label*="reaction"]');
                        const likesText = likeElement?.textContent || '0';
                        const likes = parseInt(likesText.replace(/\D/g, '')) || 0;

                        const commentElement = element.querySelector('[aria-label*="comment"]');
                        const commentsText = commentElement?.textContent || '0';
                        const comments = parseInt(commentsText.replace(/\D/g, '')) || 0;

                        // Extract post ID from URL
                        const postIdMatch = postUrl.match(/\/posts\/(\d+)/) ||
                                          postUrl.match(/\/photos\/[^/]+\/(\d+)/) ||
                                          postUrl.match(/\/videos\/(\d+)/);
                        const postId = postIdMatch ? postIdMatch[1] : `${pageName}_${i}`;

                        results.push({
                            postId,
                            content,
                            postUrl: postUrl || `https://www.facebook.com/${pageName}`,
                            mediaUrls: images,
                            likes,
                            comments,
                        });
                    } catch (error) {
                        console.error('Error parsing post:', error);
                    }
                }

                return results;
            }, { pageName: cleanedPageName, maxPosts });

            this.logger.log(`✅ Extracted ${posts.length} posts from page`);

            // Convert to ScrapedPost entities
            for (const postData of posts) {
                const post = new ScrapedPost();
                post.platform = Platform.FACEBOOK;
                post.postId = postData.postId;
                post.authorUsername = cleanedPageName;
                post.authorName = cleanedPageName;
                post.content = postData.content;
                post.postUrl = postData.postUrl;
                post.mediaUrls = postData.mediaUrls || [];
                post.thumbnailUrl = postData.mediaUrls?.[0] || '';
                post.mediaType = MediaType.IMAGE;
                post.likes = postData.likes || 0;
                post.comments = postData.comments || 0;
                post.views = 0;

                scrapedPosts.push(post);
            }

            if (scrapedPosts.length > 0) {
                this.logger.log(`💾 Saving ${scrapedPosts.length} posts to database...`);
                const saved = await this.scrapedPostRepository.save(scrapedPosts);
                this.logger.log(`✅ Successfully saved ${saved.length} posts`);
                return saved;
            }
            
            this.logger.warn('⚠️ No posts found');
            return [];

        } catch (error) {
            this.logger.error(`❌ Error scraping Facebook page: ${error.message}`);
            this.logger.error(`❌ Stack trace: ${error.stack}`);
            return [];
        } finally {
            if (context) {
                this.logger.log('🧹 Closing Facebook tab...');
                try {
                    await new Promise(r => setTimeout(r, 2000));
                    await context.close();
                    this.logger.log('✅ Facebook tab closed');
                } catch (closeError) {
                    this.logger.error(`⚠️ Error closing tab: ${closeError.message}`);
                }
            }
        }
    }

    /**
     * Scrape posts from multiple Facebook pages by username
     * This is the main method called by the frontend with keywords
     */
    async scrapeByHashtag(hashtag: string, maxResults: number = 12): Promise<ScrapedPost[]> {
        // Treat "hashtag" as page name(s) - can be comma-separated
        const pageNames = hashtag.split(',').map(p => p.trim()).filter(p => p.length > 0);
        
        if (pageNames.length === 0) {
            this.logger.warn('⚠️  No page names provided');
            return [];
        }

        this.logger.log(`📥 Scraping ${pageNames.length} Facebook pages: ${pageNames.join(', ')}`);
        
        const allPosts: ScrapedPost[] = [];
        
        // Scrape each page
        for (const pageName of pageNames) {
            const posts = await this.scrapeByUsername(pageName);
            allPosts.push(...posts);
            
            // Add small delay between requests to avoid rate limiting
            if (pageNames.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        this.logger.log(`✅ Total posts scraped: ${allPosts.length} from ${pageNames.length} pages`);
        return allPosts.slice(0, maxResults); // Limit to maxResults
    }

    /**
     * Legacy method for backward compatibility
     */
    async scrapePost(postUrl: string): Promise<ScrapedPost | null> {
        this.logger.warn('⚠️  scrapePost() is deprecated. Use scrapeByUsername() instead.');
        
        // Try to extract page name from URL
        const pageMatch = postUrl.match(/facebook\.com\/([^\/\?]+)/);
        if (pageMatch && pageMatch[1]) {
            const pageName = pageMatch[1];
            const posts = await this.scrapeByUsername(pageName);
            return posts.length > 0 ? posts[0] : null;
        }
        
        return null;
    }

    /**
     * Scrape multiple pages - batch processing
     */
    async scrapeMultiplePosts(pageNames: string[]): Promise<ScrapedPost[]> {
        this.logger.log(`📥 Starting batch scrape for ${pageNames.length} pages...`);
        
        const allPosts: ScrapedPost[] = [];
        
        for (const pageName of pageNames) {
            const posts = await this.scrapeByUsername(pageName);
            allPosts.push(...posts);
            
            // Add delay between requests
            if (pageNames.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        this.logger.log(`✅ Batch scrape complete: ${allPosts.length} total posts`);
        return allPosts;
    }
}
