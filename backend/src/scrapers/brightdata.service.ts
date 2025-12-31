import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';

@Injectable()
export class BrightDataService {
    private readonly logger = new Logger(BrightDataService.name);
    private readonly proxyUrl: string;

    constructor(private readonly configService: ConfigService) {
        const host = this.configService.get<string>('BRIGHTDATA_PROXY_HOST');
        const port = this.configService.get<string>('BRIGHTDATA_PROXY_PORT');
        const username = this.configService.get<string>('BRIGHTDATA_PROXY_USERNAME');
        const password = this.configService.get<string>('BRIGHTDATA_PROXY_PASSWORD');

        // Build proxy URL: http://username:password@host:port
        this.proxyUrl = `http://${username}:${password}@${host}:${port}`;
        
        this.logger.log(`✅ BrightData proxy configured: ${host}:${port}`);
    }

    /**
     * Fetch a page through BrightData proxy
     */
    async fetchPage(url: string): Promise<string> {
        this.logger.log(`🌐 Fetching via BrightData: ${url}`);

        return new Promise((resolve, reject) => {
            const proxyAgent = new HttpsProxyAgent(this.proxyUrl);

            const options = {
                agent: proxyAgent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
            };

            https.get(url, options, (res) => {
                let body = '';

                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        this.logger.log(`✅ Successfully fetched page (${body.length} chars)`);
                        resolve(body);
                    } else {
                        this.logger.error(`❌ BrightData error: Status ${res.statusCode}`);
                        reject(new Error(`BrightData returned status ${res.statusCode}`));
                    }
                });
            }).on('error', (error) => {
                this.logger.error(`❌ Request failed: ${error.message}`);
                reject(error);
            });
        });
    }

    /**
     * Get proxy configuration for Playwright
     */
    getProxyConfig() {
        const host = this.configService.get<string>('BRIGHTDATA_PROXY_HOST');
        const port = this.configService.get<string>('BRIGHTDATA_PROXY_PORT');
        const username = this.configService.get<string>('BRIGHTDATA_PROXY_USERNAME');
        const password = this.configService.get<string>('BRIGHTDATA_PROXY_PASSWORD');

        return {
            server: `http://${host}:${port}`,
            username: username,
            password: password,
        };
    }
}
