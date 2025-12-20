import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { Platform } from './scraped-post.entity';

export enum BanType {
    IP_BAN = 'ip_ban',
    RATE_LIMIT = 'rate_limit',
    CAPTCHA = 'captcha',
    OTHER = 'other',
}

@Entity('ban_logs')
export class BanLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: Platform,
    })
    platform: Platform;

    @Column({
        type: 'enum',
        enum: BanType,
    })
    banType: BanType;

    @Column({ nullable: true })
    ipAddress: string;

    @Column({ type: 'text', nullable: true })
    details: string;

    @CreateDateColumn()
    detectedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    recoveredAt: Date;
}