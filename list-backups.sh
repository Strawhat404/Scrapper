#!/bin/bash

# ============================================
# List Database Backups
# ============================================

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BACKUP_DIR="./backups"

echo -e "${BLUE}==================================${NC}"
echo -e "${BLUE}  Database Backup Status${NC}"
echo -e "${BLUE}==================================${NC}"
echo ""

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}No backups directory found.${NC}"
    echo "Run ./backup.sh to create your first backup."
    exit 0
fi

# Count backups
BACKUP_COUNT=$(ls -1 $BACKUP_DIR/backup_*.sql.gz 2>/dev/null | wc -l)

if [ $BACKUP_COUNT -eq 0 ]; then
    echo -e "${YELLOW}No backups found.${NC}"
    echo "Run ./backup.sh to create your first backup."
    exit 0
fi

# Show backup statistics
echo -e "${GREEN}Total backups: ${BACKUP_COUNT}${NC}"

# Calculate total size
TOTAL_SIZE=$(du -sh $BACKUP_DIR 2>/dev/null | cut -f1)
echo -e "${GREEN}Total size: ${TOTAL_SIZE}${NC}"

# Show newest backup
NEWEST=$(ls -t $BACKUP_DIR/backup_*.sql.gz 2>/dev/null | head -1)
if [ ! -z "$NEWEST" ]; then
    NEWEST_DATE=$(stat -c %y "$NEWEST" 2>/dev/null | cut -d'.' -f1)
    echo -e "${GREEN}Latest backup: $(basename $NEWEST)${NC}"
    echo -e "${GREEN}Created: ${NEWEST_DATE}${NC}"
fi

echo ""
echo -e "${BLUE}All backups:${NC}"
echo ""

# List all backups with details
ls -lh $BACKUP_DIR/backup_*.sql.gz 2>/dev/null | awk '{
    # Extract date from filename
    split($9, parts, "_")
    date = parts[2]
    time = parts[3]
    gsub(".sql.gz", "", time)
    
    # Format date
    year = substr(date, 1, 4)
    month = substr(date, 5, 2)
    day = substr(date, 7, 2)
    
    # Format time
    hour = substr(time, 1, 2)
    min = substr(time, 3, 2)
    sec = substr(time, 5, 2)
    
    printf "  %s  %s  %s/%s/%s %s:%s:%s\n", $5, $9, year, month, day, hour, min, sec
}'

echo ""
echo -e "${YELLOW}Commands:${NC}"
echo "  ./backup.sh       - Create new backup"
echo "  ./restore.sh      - Restore from backup"
echo "  ./list-backups.sh - Show this list"
