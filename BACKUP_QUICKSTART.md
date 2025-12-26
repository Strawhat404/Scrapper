# Database Backup - Quick Reference

## 🎯 Three Simple Commands

```bash
# Create a backup
./backup.sh

# View all backups
./list-backups.sh

# Restore from backup
./restore.sh
```

## 📅 Setup Automatic Daily Backups

```bash
# Edit crontab
crontab -e

# Add this line (runs at 2 AM daily)
0 2 * * * cd /home/pirate/Documents/Projects/Scrapper && ./backup.sh
```

## 🔄 Before Important Changes

Always backup before:
- Deploying updates
- Running migrations
- Modifying database schema

```bash
./backup.sh
```

## 💾 Backup Storage

- **Location**: `./backups/` directory
- **Format**: Compressed SQL (`.sql.gz`)
- **Retention**: Keeps last 7 days automatically
- **Naming**: `backup_YYYYMMDD_HHMMSS.sql.gz`

## 🚨 Emergency Restore

```bash
./restore.sh
# Select backup number
# Confirm with "yes"
```

## 📊 Check Backup Status

```bash
./list-backups.sh
```

Shows:
- Total number of backups
- Total size
- Latest backup date
- List of all backups

## ☁️ Copy Backups to Cloud (Optional)

```bash
# To external drive
cp backups/*.sql.gz /mnt/external-drive/

# To remote server
rsync -avz backups/ user@server:/backups/

# To AWS S3 (if configured)
aws s3 sync backups/ s3://your-bucket/backups/
```

## 📝 Notes

- Backups are already in `.gitignore` (won't be committed)
- Each backup is compressed to save space
- Old backups (>7 days) are automatically deleted
- All scripts have colored output for easy reading

## 🆘 Troubleshooting

**Container not running?**
```bash
docker-compose up -d
```

**Need more help?**
Read the full guide: `BACKUP_GUIDE.md`
