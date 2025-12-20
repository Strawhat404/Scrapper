import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export enum Platform {
    YOUTUBE = 'youtube',
    TWITTER = 'twitter',
    TIKTOK = 'tiktok',
    INSTAGRAM = 'instagram',
    FACEBOOK = 'facebook',
}

export enum MediaType {
    TEXT = 'text',
    IMAGE = 'image',
    VIDEO = 'video',
}

@Entity('scraped_posts')
export class ScrapedPost {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: Platform,
    })
    platform: Platform;

    @Column({ nullable: true })
    postId: string;

    @Column({ nullable: true })
    authorName: string;

    @Column({ nullable: true })
    authorUsername: string;

    @Column({ type: 'text', nullable: true })
    content: string;

    @Column({
        type: 'enum',
        enum: MediaType,
        default: MediaType.TEXT,
    })
    mediaType: MediaType;

    @Column({ type: 'jsonb', nullable: true })
    mediaUrls: string[];

    @Column({ nullable: true })
    thumbnailUrl: string;

    @Column({ type: 'int', default: 0 })
    likes: number;

    @Column({ type: 'int', default: 0 })
    views: number;

    @Column({ type: 'int', default: 0 })
    comments: number;

    @Column({ nullable: true })
    postUrl: string;

    @CreateDateColumn()
    scrapedAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}