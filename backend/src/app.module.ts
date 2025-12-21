import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScrapedPost } from './database/entities/scraped-post.entity';
import { ScrapingJob } from './database/entities/scraping-job.entity';
import { BanLog } from './database/entities/ban-log.entity';
import { YoutubeModule } from './scrapers/youtube/youtube.module';
import { TestController } from './test.controller';
import { TwitterModule } from './scrapers/twitter/twitter.module';
import { TiktokModule } from './scrapers/tiktok/tiktok.module';
import { InstagramModule } from './scrapers/instagram/instagram.module';

@Module({
  imports: [
    // 1. Load .env file
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 2. Connect to Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [ScrapedPost, ScrapingJob, BanLog],
        synchronize: true, // Dev only
      }),
    }),

    // 3. Feature Modules
    YoutubeModule,
    TwitterModule,
    TiktokModule,
    InstagramModule,
  ],
  controllers: [AppController, TestController],
  providers: [AppService],
})
export class AppModule { }