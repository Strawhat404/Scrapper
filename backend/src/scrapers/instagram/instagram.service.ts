import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ScrapedPost, Platform, MediaType } from '../../database/entities/scraped-post.entity';
import { BrightDataService } from '../brightdata.service';
import { HttpsProxyAgent } from 'https-proxy-agent';

@Injectable()
export class InstagramService {
    private readonly logger = new Logger(InstagramService.name);
    private readonly X_IG_APP_ID = '936619743392459'; // Instagram's public app ID

    constructor(
        @InjectRepository(ScrapedPost)
        private readonly scrapedPostRepository: Repository<ScrapedPost>,
        private readonly configService: ConfigService,
        private readonly brightDataService: BrightDataService,
    ) {
        this.logger.log(`✅ Instagram Scraper initialized (GraphQL API + Residential Proxy)`);
    }

    /**
     * Clean username - remove @ symbol if present
     */
    private cleanUsername(username: string): string {
        return username.replace(/^@/, '').trim();
    }

    /**
     * Get random delay for human-like behavior
     */
    private getRandomDelay(min: number = 2000, max: number = 5000): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Scrape posts from an Instagram profile using GraphQL API
     */
    async scrapeByUsername(username: string, maxPosts: number = 12): Promise<ScrapedPost[]> {
        try {
            const cleanedUsername = this.cleanUsername(username);
            this.logger.log(`🔍 Scraping Instagram profile via GraphQL API: @${cleanedUsername}`);

            // Use Instagram's internal GraphQL API
            const apiUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanedUsername}`;
            
            // Setup proxy agent
            const proxyConfig = this.brightDataService.getProxyConfig();
            // proxyConfig.server already includes protocol and port (e.g., "http://host:port")
            const serverWithoutProtocol = proxyConfig.server.replace(/^https?:\/\//, '');
            const proxyUrl = `http://${proxyConfig.username}:${proxyConfig.password}@${serverWithoutProtocol}`;
            const agent = new HttpsProxyAgent(proxyUrl);

            // Mobile User-Agent (iPhone) - lighter security
            const headers = {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'X-IG-App-ID': this.X_IG_APP_ID,
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://www.instagram.com/',
                'Origin': 'https://www.instagram.com',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
            };

            this.logger.log(`📤 Fetching: ${apiUrl}`);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: headers,
                // @ts-ignore
                agent: agent,
            });

            this.logger.log(`📥 Response Status: ${response.status}`);

            if (!response.ok) {
                this.logger.error(`❌ Instagram API returned status: ${response.status}`);
                const errorText = await response.text();
                this.logger.error(`Error details: ${errorText.substring(0, 200)}`);
                return [];
            }

            const data = await response.json();
            
            if (!data || !data.data || !data.data.user) {
                this.logger.error('❌ Invalid response format from Instagram API');
                return [];
            }

            const userData = data.data.user;
            const edges = userData.edge_owner_to_timeline_media?.edges || [];
            
            if (edges.length === 0) {
                this.logger.warn(`⚠️  No posts found for @${cleanedUsername}`);
                return [];
            }

            this.logger.log(`📦 Found ${edges.length} posts from @${cleanedUsername}`);

            // Process posts
            const savedPosts: ScrapedPost[] = [];
            const postsToProcess = edges.slice(0, maxPosts);

            for (let i = 0; i < postsToProcess.length; i++) {
                const edge = postsToProcess[i];
                const node = edge.node;
                
                try {
                    const post = new ScrapedPost();
                    post.platform = Platform.INSTAGRAM;
                    post.postId = node.shortcode || node.id;
                    post.authorUsername = cleanedUsername;
                    post.authorName = userData.full_name || cleanedUsername;
                    post.content = node.edge_media_to_caption?.edges[0]?.node?.text || '';
                    post.postUrl = `https://www.instagram.com/p/${node.shortcode}/`;
                    
                    // Extract media URLs
                    const mediaUrls: string[] = [];
                    if (node.display_url) {
                        mediaUrls.push(node.display_url);
                    }
                    
                    // Check if it's a carousel (multiple images)
                    if (node.edge_sidecar_to_children?.edges) {
                        node.edge_sidecar_to_children.edges.forEach((child: any) => {
                            if (child.node.display_url) {
                                mediaUrls.push(child.node.display_url);
                            }
                        });
                    }
                    
                    post.mediaUrls = mediaUrls;
                    post.thumbnailUrl = node.thumbnail_src || node.display_url || '';
                    post.mediaType = node.is_video ? MediaType.VIDEO : MediaType.IMAGE;
                    
                    // Engagement metrics
                    post.likes = node.edge_liked_by?.count || node.edge_media_preview_like?.count || 0;
                    post.comments = node.edge_media_to_comment?.count || 0;
                    post.views = node.video_view_count || 0;

                    // Save to database
                    const savedPost = await this.scrapedPostRepository.save(post);
                    savedPosts.push(savedPost);
                    
                    this.logger.log(`✅ [${i + 1}/${postsToProcess.length}] Scraped post: ${post.postId}`);
                    
                    // Human-like delay between processing posts
                    if (i < postsToProcess.length - 1) {
                        const delay = this.getRandomDelay(500, 1500);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    
                } catch (error) {
                    this.logger.error(`❌ [${i + 1}/${postsToProcess.length}] Failed to process post: ${error.message}`);
                }
            }

            this.logger.log(`✅ Successfully scraped ${savedPosts.length} posts from @${cleanedUsername}`);
            return savedPosts;

        } catch (error) {
            this.logger.error(`❌ Error scraping Instagram profile: ${error.message}`);
            return [];
        }
    }

    /**
     * Scrape posts from multiple Instagram profiles by username
     * This is the main method called by the frontend with keywords
     */
    async scrapeByHashtag(hashtag: string, maxResults: number = 12): Promise<ScrapedPost[]> {
        // Treat "hashtag" as username(s) - can be comma-separated
        const usernames = hashtag.split(',').map(u => u.trim()).filter(u => u.length > 0);
        
        if (usernames.length === 0) {
            this.logger.warn('⚠️  No usernames provided');
            return [];
        }

        this.logger.log(`📥 Scraping ${usernames.length} Instagram profiles: ${usernames.join(', ')}`);
        
        const allPosts: ScrapedPost[] = [];
        const postsPerProfile = Math.ceil(maxResults / usernames.length);
        
        // Scrape each username with human-like delays
        for (const username of usernames) {
            const posts = await this.scrapeByUsername(username, postsPerProfile);
            allPosts.push(...posts);
            
            // Human-like delay between profiles (30-60 seconds as recommended)
            if (usernames.length > 1) {
                const delay = this.getRandomDelay(30000, 60000);
                this.logger.log(`⏳ Waiting ${Math.round(delay / 1000)}s before next profile...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        this.logger.log(`✅ Total posts scraped: ${allPosts.length} from ${usernames.length} profiles`);
        return allPosts.slice(0, maxResults); // Limit to maxResults
    }

    /**
     * Legacy method for backward compatibility
     */
    async scrapePost(postUrl: string): Promise<ScrapedPost | null> {
        this.logger.warn('⚠️  scrapePost() is deprecated. Use scrapeByUsername() instead.');
        
        // Try to extract username from URL
        const usernameMatch = postUrl.match(/instagram\.com\/([^\/\?]+)/);
        if (usernameMatch && usernameMatch[1]) {
            const username = usernameMatch[1];
            const posts = await this.scrapeByUsername(username, 1);
            return posts.length > 0 ? posts[0] : null;
        }
        
        return null;
    }

    /**
     * Scrape multiple profiles - batch processing
     */
    async scrapeMultiplePosts(usernames: string[]): Promise<ScrapedPost[]> {
        this.logger.log(`📥 Starting batch scrape for ${usernames.length} profiles...`);
        
        const allPosts: ScrapedPost[] = [];
        
        for (const username of usernames) {
            const posts = await this.scrapeByUsername(username, 12);
            allPosts.push(...posts);
            
            // Human-like delay between profiles
            if (usernames.length > 1) {
                const delay = this.getRandomDelay(30000, 60000);
                this.logger.log(`⏳ Waiting ${Math.round(delay / 1000)}s before next profile...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        this.logger.log(`✅ Batch scrape complete: ${allPosts.length} total posts`);
        return allPosts;
    }
}
