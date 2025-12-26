# Social Pulse Setup Guide

## Architecture

- **Database (PostgreSQL)**: Runs in Docker on port 5433
- **Frontend (React + Nginx)**: Runs in Docker on port 8080
- **Backend (NestJS)**: Runs locally on your machine on port 3000

## Quick Start

### 1. Stop any existing Docker containers
```bash
docker-compose down
```

### 2. Start Database and Frontend
```bash
docker-compose up -d
```

This will start:
- PostgreSQL database on `localhost:5433`
- Frontend on `http://localhost:8080`

### 3. Start Backend Locally
```bash
cd backend
npm install  # First time only
npm run start:dev
```

Backend will run on `http://localhost:3000`

## Verify Everything is Running

### Check Docker containers
```bash
docker-compose ps
```

You should see:
- `social-pulse-db` (postgres)
- `social-pulse-frontend` (nginx)

### Check Backend
Your terminal should show:
```
[Nest] LOG [NestApplication] Nest application successfully started
🚀 Backend running on http://localhost:3000
```

### Test the API
```bash
# Test backend is responding
curl http://localhost:3000

# Test a scraper
curl "http://localhost:3000/test/twitter?q=cats"
```

### Access the Dashboard
Open your browser to: http://localhost:8080

## Stopping Services

### Stop Docker services
```bash
docker-compose down
```

### Stop Backend
Press `Ctrl+C` in the terminal where backend is running

## Troubleshooting

### Port 3000 already in use
If you see `EADDRINUSE: address already in use :::3000`:

1. Make sure no Docker backend is running:
   ```bash
   docker-compose down
   ```

2. Check what's using port 3000:
   ```bash
   sudo ss -lptn 'sport = :3000'
   ```

3. Kill the process if needed:
   ```bash
   sudo fuser -k 3000/tcp
   ```

### Database connection issues
Make sure PostgreSQL is running:
```bash
docker-compose ps postgres
```

If not running:
```bash
docker-compose up -d postgres
```

### Frontend can't connect to backend
Make sure:
1. Backend is running on port 3000
2. Frontend API URL is set to `http://localhost:3000`

## Development Workflow

1. Start Docker services (database + frontend):
   ```bash
   docker-compose up -d
   ```

2. Start backend in development mode:
   ```bash
   cd backend
   npm run start:dev
   ```

3. Make changes to backend code - it will auto-reload!

4. View logs in the terminal where backend is running

5. When done, stop everything:
   ```bash
   # Stop backend: Ctrl+C in terminal
   # Stop Docker:
   docker-compose down
   ```

## Logs

### Backend Logs
Logs appear directly in the terminal where you ran `npm run start:dev`

### Frontend Logs
```bash
docker-compose logs -f frontend
```

### Database Logs
```bash
docker-compose logs -f postgres
```

## Database Backups

### Create backup
```bash
./backup.sh
```

### List backups
```bash
./list-backups.sh
```

### Restore backup
```bash
./restore.sh backups/backup_YYYYMMDD_HHMMSS.sql.gz
```
