import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TestController } from './test.controller';
import { YoutubeModule } from './scrapers/youtube/youtube.module';
import { TwitterModule } from './scrapers/twitter/twitter.module';
import { TiktokModule } from './scrapers/tiktok/tiktok.module';
import { InstagramModule } from './scrapers/instagram/instagram.module';
import { FacebookModule } from './scrapers/facebook/facebook.module';
import { SharedBrowserModule } from './scrapers/shared-browser.module';
import { ScrapedPost } from './database/entities/scraped-post.entity';
import { ScrapingJob } from './database/entities/scraping-job.entity';
import { BanLog } from './database/entities/ban-log.entity';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [ScrapedPost, ScrapingJob, BanLog],
        synchronize: true, // Set to false in production
      }),
    }),

    // ADD THIS LINE - Makes ScrapedPost available to TestController
    TypeOrmModule.forFeature([ScrapedPost]),

    // Shared browser (global)
    SharedBrowserModule,

    // Scraper modules
    YoutubeModule,
    TwitterModule,
    TiktokModule,
    InstagramModule,
    FacebookModule,
  ],
  controllers: [AppController, TestController],
  providers: [AppService],
})
export class AppModule {}
