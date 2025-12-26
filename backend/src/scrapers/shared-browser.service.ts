import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Enable stealth mode
chromium.use(StealthPlugin());

@Injectable()
export class SharedBrowserService implements OnModuleDestroy {
    private readonly logger = new Logger(SharedBrowserService.name);
    private browser: any = null;
    private isLaunching = false;

    /**
     * Get or create a shared browser instance
     * All scrapers will use this same browser but in different tabs
     */
    async getBrowser(headless: boolean = false): Promise<any> {
        // If browser exists and is connected, return it
        if (this.browser && this.browser.isConnected()) {
            this.logger.log('♻️ Reusing existing browser instance');
            return this.browser;
        }

        // If another scraper is already launching the browser, wait for it
        if (this.isLaunching) {
            this.logger.log('⏳ Waiting for browser to launch...');
            while (this.isLaunching) {
                await new Promise(r => setTimeout(r, 100));
            }
            return this.browser;
        }

        // Launch new browser
        this.isLaunching = true;
        try {
            this.logger.log(`🚀 Launching shared browser (${headless ? 'headless' : 'visible'})...`);
            this.browser = await chromium.launch({
                headless: headless,
                args: ['--disable-blink-features=AutomationControlled']
            });
            this.logger.log('✅ Shared browser launched successfully');
            return this.browser;
        } catch (error) {
            this.logger.error(`❌ Failed to launch shared browser: ${error.message}`);
            throw error;
        } finally {
            this.isLaunching = false;
        }
    }

    /**
     * Create a new context (tab) in the shared browser
     */
    async createContext(userAgent?: string): Promise<any> {
        const browser = await this.getBrowser();
        const context = await browser.newContext({
            userAgent: userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        });
        this.logger.log('📑 Created new browser context (tab)');
        return context;
    }

    /**
     * Close the shared browser when the application shuts down
     */
    async onModuleDestroy() {
        if (this.browser) {
            this.logger.log('🧹 Closing shared browser on application shutdown...');
            try {
                await this.browser.close();
                this.logger.log('✅ Shared browser closed');
            } catch (error) {
                this.logger.error(`⚠️ Error closing shared browser: ${error.message}`);
            }
        }
    }

    /**
     * Manually close the browser (useful for cleanup)
     */
    async closeBrowser() {
        if (this.browser) {
            this.logger.log('🧹 Manually closing shared browser...');
            try {
                await this.browser.close();
                this.browser = null;
                this.logger.log('✅ Shared browser closed');
            } catch (error) {
                this.logger.error(`⚠️ Error closing shared browser: ${error.message}`);
            }
        }
    }
}
