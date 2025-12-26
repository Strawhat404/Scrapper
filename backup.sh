#!/bin/bash

# ============================================
# PostgreSQL Backup Script
# ============================================
# This script creates automated backups of your PostgreSQL database
# and keeps only the last 7 days of backups to save space.

# Configuration
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="backup_${DATE}.sql"
KEEP_DAYS=7

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo -e "${YELLOW}Starting database backup...${NC}"

# Check if Docker Compose is running
if ! docker-compose ps | grep -q "social-pulse-db"; then
    echo -e "${RED}Error: PostgreSQL container is not running!${NC}"
    echo "Please start Docker Compose first: docker-compose up -d"
    exit 1
fi

# Backup database
docker-compose exec -T postgres pg_dump -U admin socialpulse > "$BACKUP_DIR/$FILENAME"

# Check if backup was successful
if [ $? -eq 0 ]; then
    # Compress backup
    gzip "$BACKUP_DIR/$FILENAME"
    
    # Get backup size
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/${FILENAME}.gz" | cut -f1)
    
    echo -e "${GREEN}✓ Backup successful!${NC}"
    echo "  File: ${FILENAME}.gz"
    echo "  Size: ${BACKUP_SIZE}"
    echo "  Location: ${BACKUP_DIR}/${FILENAME}.gz"
    
    # Delete old backups (keep only last 7 days)
    DELETED=$(find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +$KEEP_DAYS -delete -print | wc -l)
    if [ $DELETED -gt 0 ]; then
        echo -e "${YELLOW}  Cleaned up ${DELETED} old backup(s)${NC}"
    fi
    
    # Show total backups
    TOTAL_BACKUPS=$(ls -1 $BACKUP_DIR/backup_*.sql.gz 2>/dev/null | wc -l)
    echo "  Total backups: ${TOTAL_BACKUPS}"
    
else
    echo -e "${RED}✗ Backup failed!${NC}"
    exit 1
fi
