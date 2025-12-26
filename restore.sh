#!/bin/bash

# ============================================
# PostgreSQL Restore Script
# ============================================
# This script restores your database from a backup file

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

BACKUP_DIR="./backups"

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}Error: Backup directory not found!${NC}"
    exit 1
fi

# List available backups
echo -e "${YELLOW}Available backups:${NC}"
echo ""
ls -lh $BACKUP_DIR/backup_*.sql.gz 2>/dev/null | awk '{print NR". "$9" ("$5")"}'

# Count backups
BACKUP_COUNT=$(ls -1 $BACKUP_DIR/backup_*.sql.gz 2>/dev/null | wc -l)

if [ $BACKUP_COUNT -eq 0 ]; then
    echo -e "${RED}No backups found!${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Enter the number of the backup to restore (or 'q' to quit):${NC}"
read -p "> " CHOICE

if [ "$CHOICE" = "q" ]; then
    echo "Cancelled."
    exit 0
fi

# Get the selected backup file
BACKUP_FILE=$(ls -1 $BACKUP_DIR/backup_*.sql.gz 2>/dev/null | sed -n "${CHOICE}p")

if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}Invalid selection!${NC}"
    exit 1
fi

echo ""
echo -e "${RED}WARNING: This will replace your current database!${NC}"
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

# Check if Docker Compose is running
if ! docker-compose ps | grep -q "social-pulse-db"; then
    echo -e "${RED}Error: PostgreSQL container is not running!${NC}"
    echo "Please start Docker Compose first: docker-compose up -d"
    exit 1
fi

echo -e "${YELLOW}Restoring database...${NC}"

# Decompress backup
TEMP_FILE="${BACKUP_FILE%.gz}"
gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"

# Drop existing database and recreate
docker-compose exec -T postgres psql -U admin -d postgres -c "DROP DATABASE IF EXISTS socialpulse;"
docker-compose exec -T postgres psql -U admin -d postgres -c "CREATE DATABASE socialpulse;"

# Restore backup
docker-compose exec -T postgres psql -U admin socialpulse < "$TEMP_FILE"

# Check if restore was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database restored successfully!${NC}"
    rm "$TEMP_FILE"  # Clean up temp file
else
    echo -e "${RED}✗ Restore failed!${NC}"
    rm "$TEMP_FILE"  # Clean up temp file
    exit 1
fi
