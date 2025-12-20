import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Platform } from './scraped-post.entity';

export enum JobStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
    PAUSED = 'paused',
}

@Entity('scraping_jobs')
export class ScrapingJob {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: Platform,
    })
    platform: Platform;

    @Column({
        type: 'enum',
        enum: JobStatus,
        default: JobStatus.PENDING,
    })
    status: JobStatus;

    @Column()
    targetUrl: string; // The URL or keyword being scraped

    @Column({ type: 'int', default: 0 })
    itemsScraped: number;

    @Column({ type: 'jsonb', nullable: true })
    errors: any;

    @CreateDateColumn()
    startedAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    completedAt: Date;
}