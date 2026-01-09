# Social Pulse Database Architecture

## Overview

Social Pulse uses **PostgreSQL 15** as its primary database, managed through **TypeORM** (an Object-Relational Mapping framework) in a NestJS backend application. The database is containerized using Docker for easy deployment and scalability.

---

## Database Setup

### Infrastructure

- **Database Engine**: PostgreSQL 15 (Alpine Linux)
- **Container**: Docker container named `social-pulse-db`
- **Port Mapping**: Host port `5433` → Container port `5432`
- **ORM**: TypeORM with NestJS integration
- **Data Persistence**: Docker volume (`postgres_data`) for persistent storage

### Connection Configuration

```
Host: localhost
Port: 5433
Database: socialpulse
Username: admin
Password: securepassword123
```

### TypeORM Configuration

- **Synchronize Mode**: Enabled (auto-creates/updates tables based on entities)
- **Migration Support**: Available for production-safe schema changes
- **Entity Auto-loading**: All entities are registered in the app module

---

## Database Schema

The database consists of **3 main tables** that track social media scraping operations:

### 1. **scraped_posts** - Core Content Storage

Stores all scraped social media posts from multiple platforms.

#### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `platform` | ENUM | Platform source (youtube, twitter, tiktok, instagram, facebook) |
| `postId` | VARCHAR | Original post ID from the platform |
| `authorName` | VARCHAR | Display name of the content creator |
| `authorUsername` | VARCHAR | Username/handle of the creator |
| `content` | TEXT | Post text/caption content |
| `mediaType` | ENUM | Type of media (text, image, video) |
| `mediaUrls` | JSONB | Array of media URLs stored as JSON |
| `thumbnailUrl` | VARCHAR | Thumbnail/preview image URL |
| `likes` | BIGINT | Number of likes (supports large numbers) |
| `views` | BIGINT | Number of views (supports large numbers) |
| `comments` | BIGINT | Number of comments (supports large numbers) |
| `postUrl` | VARCHAR | Direct URL to the original post |
| `scrapedAt` | TIMESTAMP | When the post was scraped |
| `createdAt` | TIMESTAMP | Record creation timestamp |

#### Key Features

- **JSONB Storage**: Media URLs are stored as JSON arrays for flexible multi-media support
- **BIGINT Metrics**: Engagement metrics (likes, views, comments) use BIGINT to handle viral content with millions of interactions
- **Platform Enum**: Ensures data integrity by restricting platform values to predefined options
- **Nullable Fields**: Most fields are nullable to handle incomplete data from different platforms

---

### 2. **scraping_jobs** - Job Management

Tracks the status and progress of scraping operations.

#### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `platform` | ENUM | Target platform for scraping |
| `status` | ENUM | Job status (pending, running, completed, failed, paused) |
| `targetUrl` | VARCHAR | URL or keyword being scraped |
| `itemsScraped` | INTEGER | Count of successfully scraped items |
| `errors` | JSONB | Error details stored as JSON |
| `startedAt` | TIMESTAMP | Job start time |
| `updatedAt` | TIMESTAMP | Last update time (auto-updated) |
| `completedAt` | TIMESTAMP | Job completion time (nullable) |

#### Key Features

- **Status Tracking**: Five-state job lifecycle (pending → running → completed/failed/paused)
- **Progress Monitoring**: Real-time tracking of items scraped
- **Error Logging**: JSONB field stores detailed error information for debugging
- **Automatic Timestamps**: `updatedAt` automatically updates on any change

---

### 3. **ban_logs** - Anti-Detection Monitoring

Logs detection events and platform restrictions to monitor scraping health.

#### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `platform` | ENUM | Platform where ban was detected |
| `banType` | ENUM | Type of restriction (ip_ban, rate_limit, captcha, other) |
| `ipAddress` | VARCHAR | IP address that was banned (nullable) |
| `details` | TEXT | Additional details about the ban |
| `detectedAt` | TIMESTAMP | When the ban was detected |
| `recoveredAt` | TIMESTAMP | When access was restored (nullable) |

#### Key Features

- **Ban Classification**: Categorizes different types of platform restrictions
- **Recovery Tracking**: Monitors when access is restored after bans
- **IP Tracking**: Records which IPs are affected for proxy rotation strategies
- **Detailed Logging**: Text field for storing error messages and context

---

## Data Storage Strategy

### 1. **Structured Data**
- Core fields (IDs, names, URLs) use standard PostgreSQL types
- Ensures efficient indexing and querying

### 2. **Semi-Structured Data (JSONB)**
- **Media URLs**: Stored as JSON arrays to handle posts with multiple images/videos
- **Error Details**: Complex error objects stored as JSON for flexibility
- **Benefits**: 
  - No schema changes needed for new media types
  - Efficient querying with PostgreSQL's JSONB operators
  - Maintains data structure while allowing flexibility

### 3. **Enumerated Types**
- **Platforms**: youtube, twitter, tiktok, instagram, facebook
- **Media Types**: text, image, video
- **Job Status**: pending, running, completed, failed, paused
- **Ban Types**: ip_ban, rate_limit, captcha, other
- **Benefits**: Data integrity, efficient storage, clear documentation

---

## Migration System

### Current Migration: ChangeToBigint

**Purpose**: Upgrade engagement metrics to handle viral content

```sql
ALTER TABLE "scraped_posts" 
ALTER COLUMN "likes" TYPE bigint,
ALTER COLUMN "views" TYPE bigint,
ALTER COLUMN "comments" TYPE bigint;
```

**Why BIGINT?**
- Standard INTEGER max: ~2.1 billion
- BIGINT max: ~9.2 quintillion
- Viral posts can exceed integer limits (e.g., YouTube videos with billions of views)

---

## How Data Flows

### 1. **Scraping Initiation**
```
User Request → Create ScrapingJob (status: pending)
```

### 2. **Active Scraping**
```
Job Status: running → Scrape Platform → Store ScrapedPost records
```

### 3. **Error Handling**
```
Ban Detected → Create BanLog → Pause/Fail Job → Store error in ScrapingJob
```

### 4. **Completion**
```
Scraping Done → Update Job (status: completed, completedAt: timestamp)
```

---

## Query Patterns

### Common Queries

**Get Recent Posts by Platform**
```typescript
await postRepository.find({
  where: { platform: Platform.INSTAGRAM },
  order: { scrapedAt: 'DESC' },
  take: 50
});
```

**Track Active Jobs**
```typescript
await jobRepository.find({
  where: { status: JobStatus.RUNNING }
});
```

**Monitor Ban Frequency**
```typescript
await banLogRepository.find({
  where: { 
    platform: Platform.TWITTER,
    recoveredAt: IsNull()
  }
});
```

**Search Posts by Content**
```typescript
await postRepository
  .createQueryBuilder('post')
  .where('post.content ILIKE :search', { search: `%${keyword}%` })
  .getMany();
```

---

## Performance Considerations

### Indexing Strategy
- **Primary Keys**: UUID indexes on all tables
- **Platform Filtering**: Enum fields are efficiently indexed
- **Timestamp Queries**: Automatic indexes on `createdAt`, `scrapedAt`
- **JSONB Queries**: PostgreSQL's GIN indexes can be added for JSONB fields

### Scalability
- **BIGINT Metrics**: Handles viral content without overflow
- **JSONB Flexibility**: No schema changes needed for new data structures
- **Docker Volumes**: Persistent storage survives container restarts
- **Connection Pooling**: TypeORM manages database connections efficiently

---

## Backup & Recovery

### Automated Backups
- Script: `backup.sh` - Creates timestamped database dumps
- Script: `list-backups.sh` - Lists available backups
- Script: `restore.sh` - Restores from backup files

### Manual Backup
```bash
docker exec social-pulse-db pg_dump -U admin socialpulse > backup.sql
```

### Restore
```bash
docker exec -i social-pulse-db psql -U admin socialpulse < backup.sql
```

---

## Health Monitoring

### Docker Healthcheck
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U admin -d socialpulse"]
  interval: 10s
  timeout: 5s
  retries: 5
```

**Purpose**: Ensures database is accepting connections before starting dependent services

---

## Security Features

1. **Isolated Network**: Database runs in Docker network, not directly exposed
2. **Port Mapping**: Non-standard port (5433) reduces automated attacks
3. **Environment Variables**: Credentials stored in `.env` files (not in code)
4. **Volume Permissions**: Data directory has restricted access
5. **Connection Limits**: PostgreSQL connection pooling prevents resource exhaustion

---

## Development vs Production

### Development (Current Setup)
- `synchronize: true` - Auto-updates schema from entities
- Direct port access (5433)
- Simple credentials

### Production Recommendations
- `synchronize: false` - Use migrations only
- Private network access only
- Strong passwords with rotation
- SSL/TLS connections
- Regular automated backups
- Read replicas for scaling
- Connection pooling with PgBouncer

---

## Summary

The Social Pulse database is designed for:
- ✅ **Multi-platform support** - Unified schema for 5+ social platforms
- ✅ **High-volume data** - BIGINT fields handle viral content
- ✅ **Flexible storage** - JSONB for varying data structures
- ✅ **Operational monitoring** - Job tracking and ban detection
- ✅ **Easy deployment** - Dockerized with persistent storage
- ✅ **Type safety** - TypeORM entities provide compile-time validation
- ✅ **Scalability** - PostgreSQL handles millions of records efficiently

The architecture balances structure (for reliable querying) with flexibility (for diverse social media data formats).
