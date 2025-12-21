import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ScrapedPost, Platform, MediaType } from '../../database/entities/scraped-post.entity';

@Injectable()
export class InstagramService {
    private readonly logger = new Logger(InstagramService.name);

    // Instagram's App ID - this is public and used by their website
    private readonly X_IG_APP_ID = '936619743392459';
    
    // User agent to mimic a real browser
    private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    constructor(
        @InjectRepository(ScrapedPost)
        private readonly scrapedPostRepository: Repository<ScrapedPost>,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Extract Instagram shortcode from URL
     * Example: "https://www.instagram.com/p/CtjoC2BNsB2/" -> "CtjoC2BNsB2"
     */
    private extractShortcode(url: string): string | null {
        const regex = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reels|reel)\/([A-Za-z0-9-_]+)/;
        const match = url.match(regex);
        return match && match[2] ? match[2] : null;
    }

    /**
     * Scrape a single Instagram post using GraphQL API
     * This method uses Instagram's internal GraphQL endpoint (no cookie needed!)
     */
    async scrapePost(postUrl: string): Promise<ScrapedPost | null> {
        try {
            const shortcode = this.extractShortcode(postUrl);
            if (!shortcode) {
                this.logger.error(`❌ Invalid Instagram URL: ${postUrl}`);
                return null;
            }

            this.logger.log(`🔍 Scraping Instagram post: ${shortcode}`);

            // Build GraphQL request URL
            const graphqlUrl = new URL('https://www.instagram.com/api/graphql');
            graphqlUrl.searchParams.set('variables', JSON.stringify({ shortcode }));
            graphqlUrl.searchParams.set('doc_id', '10015901848480474');
            graphqlUrl.searchParams.set('lsd', 'AVqbxe3J_YA');

            // Make the request to Instagram's GraphQL API
            const response = await fetch(graphqlUrl.toString(), {
                method: 'POST',
                headers: {
                    'User-Agent': this.USER_AGENT,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-IG-App-ID': this.X_IG_APP_ID,
                    'X-FB-LSD': 'AVqbxe3J_YA',
                    'X-ASBD-ID': '129477',
                    'Sec-Fetch-Site': 'same-origin'
                }
            });

            if (!response.ok) {
                this.logger.error(`❌ Instagram API returned status: ${response.status}`);
                return null;
            }

            const json = await response.json();
            const media = json?.data?.xdt_shortcode_media;

            if (!media) {
                this.logger.error('❌ No media data found in response');
                return null;
            }

            // Create ScrapedPost entity from Instagram data
            const post = new ScrapedPost();
            post.platform = Platform.INSTAGRAM;
            post.postId = media.shortcode;
            post.authorUsername = media.owner?.username || 'unknown';
            post.authorName = media.owner?.full_name || 'unknown';
            post.content = media.edge_media_to_caption?.edges[0]?.node?.text || '';
            post.postUrl = `https://www.instagram.com/p/${media.shortcode}/`;
            post.likes = media.edge_media_preview_like?.count || 0;
            post.comments = media.edge_media_to_comment?.count || 0;
            post.views = media.video_view_count || media.video_play_count || 0;
            
            // Determine media type and URLs
            if (media.is_video) {
                post.mediaType = MediaType.VIDEO;
                post.mediaUrls = media.video_url ? [media.video_url] : [];
                post.thumbnailUrl = media.thumbnail_src || media.display_url;
            } else {
                post.mediaType = MediaType.IMAGE;
                post.mediaUrls = media.display_url ? [media.display_url] : [];
                post.thumbnailUrl = media.display_url;
            }

            // Save to database
            const savedPost = await this.scrapedPostRepository.save(post);
            this.logger.log(`✅ Successfully scraped post: ${shortcode}`);

            return savedPost;

        } catch (error) {
            this.logger.error(`❌ Error scraping Instagram post: ${error.message}`);
            return null;
        }
    }

    /**
     * MASS SCRAPING: Scrape hashtag posts using Instagram's public JSON endpoint
     * 
     * EXPLANATION: This uses Instagram's public API endpoint that returns JSON data
     * for hashtag pages. No browser needed, no login required!
     * 
     * Step 1: Get post shortcodes from hashtag endpoint
     * Step 2: Use our GraphQL method to scrape each post's full data
     */
    async scrapeByHashtag(hashtag: string, maxResults: number = 12): Promise<ScrapedPost[]> {
        const tag = hashtag.replace('#', '');
        
        try {
            this.logger.log(`🔍 Fetching hashtag data for: #${tag}`);
            
            // Instagram's public hashtag endpoint with magic parameters
            const url = `https://www.instagram.com/explore/tags/${tag}/?__a=1&__d=dis`;
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': this.USER_AGENT,
                    'X-IG-App-ID': this.X_IG_APP_ID,
                    'Sec-Fetch-Site': 'same-origin'
                }
            });

            if (!response.ok) {
                this.logger.error(`❌ Instagram returned status: ${response.status}`);
                return [];
            }

            const json = await response.json();
            
            // Try different possible data structures (Instagram changes these sometimes)
            const edges = json?.data?.recent?.sections?.[0]?.layout_content?.medias || 
                         json?.graphql?.hashtag?.edge_hashtag_to_media?.edges || 
                         [];
            
            if (edges.length === 0) {
                this.logger.warn('⚠️  No posts found for this hashtag');
                return [];
            }

            this.logger.log(`✅ Found ${edges.length} posts, scraping ${Math.min(maxResults, edges.length)}...`);

            // Extract shortcodes and scrape each post
            const scrapedPosts: ScrapedPost[] = [];
            const postsToScrape = edges.slice(0, maxResults);

            for (let i = 0; i < postsToScrape.length; i++) {
                // Handle different data structures
                const shortcode = postsToScrape[i]?.media?.code || 
                                 postsToScrape[i]?.node?.shortcode;
                
                if (!shortcode) {
                    this.logger.warn(`⚠️  Skipping post ${i + 1} - no shortcode found`);
                    continue;
                }

                this.logger.log(`[${i + 1}/${postsToScrape.length}] Scraping: ${shortcode}`);
                
                const postUrl = `https://www.instagram.com/p/${shortcode}/`;
                const post = await this.scrapePost(postUrl);
                
                if (post) {
                    scrapedPosts.push(post);
                }

                // Rate limiting - wait between requests
                if (i < postsToScrape.length - 1) {
                    await this.sleep(this.getRandomDelay());
                }
            }

            this.logger.log(`✅ Successfully scraped ${scrapedPosts.length} posts from #${tag}`);
            return scrapedPosts;

        } catch (error) {
            this.logger.error(`❌ Error scraping hashtag: ${error.message}`);
            return [];
        }
    }

    /**
     * Scrape multiple posts from an array of URLs
     * This is useful if you already have a list of post URLs
     */
    async scrapeMultiplePosts(postUrls: string[]): Promise<ScrapedPost[]> {
        const scrapedPosts: ScrapedPost[] = [];

        for (const url of postUrls) {
            const post = await this.scrapePost(url);
            if (post) {
                scrapedPosts.push(post);
            }

            // Rate limiting
            await this.sleep(this.getRandomDelay());
        }

        this.logger.log(`✅ Successfully scraped ${scrapedPosts.length} out of ${postUrls.length} posts`);
        return scrapedPosts;
    }

    /**
     * Get random delay from config (anti-ban measure)
     */
    private getRandomDelay(): number {
        const min = this.configService.get<number>('SCRAPING_DELAY_MIN') || 3000;
        const max = this.configService.get<number>('SCRAPING_DELAY_MAX') || 8000;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
