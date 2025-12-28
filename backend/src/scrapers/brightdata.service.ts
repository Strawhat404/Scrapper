import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

@Injectable()
export class BrightDataService {
    private readonly logger = new Logger(BrightDataService.name);
    private readonly apiKey: string;
    private readonly zone: string;

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('BRIGHTDATA_API_KEY');
        this.zone = this.configService.get<string>('BRIGHTDATA_ZONE');
    }

    async fetchPage(url: string): Promise<string> {
        this.logger.log(`🌐 Fetching page via Bright Data: ${url}`);

        const data = JSON.stringify({
            zone: this.zone,
            url: url,
            format: 'raw'
        });

        const options = {
            hostname: 'api.brightdata.com',
            path: '/request',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Length': data.length
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let body = '';

                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        this.logger.log(`✅ Successfully fetched page (${body.length} chars)`);
                        resolve(body);
                    } else {
                        this.logger.error(`❌ Bright Data error: Status ${res.statusCode}`);
                        reject(new Error(`Bright Data returned status ${res.statusCode}`));
                    }
                });
            });

            req.on('error', (error) => {
                this.logger.error(`❌ Request failed: ${error.message}`);
                reject(error);
            });

            req.write(data);
            req.end();
        });
    }
}
