# Configuration Guide

This document explains how to configure the Social Pulse application without modifying code.

## Backend Configuration

All backend settings are in `backend/.env`:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=admin
DB_PASSWORD=securepassword123
DB_DATABASE=socialpulse

# Server Configuration
PORT=3000

# BrightData Proxy Configuration
BRIGHTDATA_API_KEY=your_api_key
BRIGHTDATA_PROXY_HOST=brd.superproxy.io
BRIGHTDATA_PROXY_PORT=33335
BRIGHTDATA_PROXY_USERNAME=your_username
BRIGHTDATA_PROXY_PASSWORD=your_password
BRIGHTDATA_ZONE=residential_proxy1

# Scraping Configuration
SCRAPING_DELAY_MIN=2000
SCRAPING_DELAY_MAX=5000
```

### Changing Backend Port

To change the backend port from 3000 to something else:

1. Edit `backend/.env`:
   ```bash
   PORT=8080  # or any port you want
   ```

2. Restart the backend:
   ```bash
   cd backend
   npm run start:dev
   ```

## Frontend Configuration

All frontend settings are in `social-pulse-dashboard/.env`:

```bash
# Backend API URL
VITE_API_BASE_URL=http://localhost:3000
```

### Connecting Frontend to Backend

**Scenario 1: Backend on same machine**
```bash
VITE_API_BASE_URL=http://localhost:3000
```

**Scenario 2: Backend on different server**
```bash
VITE_API_BASE_URL=http://192.168.1.100:3000
```

**Scenario 3: Backend on domain**
```bash
VITE_API_BASE_URL=https://api.yourdomain.com
```

### Applying Frontend Changes

After changing `.env`, restart the frontend:

```bash
cd social-pulse-dashboard
npm run dev
```

## Quick Setup for New Developers

1. **Backend Setup:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your credentials
   npm install
   npm run start:dev
   ```

2. **Frontend Setup:**
   ```bash
   cd social-pulse-dashboard
   cp .env.example .env
   # Edit .env with your backend URL
   npm install
   npm run dev
   ```

## Common Scenarios

### Moving to Production

1. **Backend** - Update `backend/.env`:
   ```bash
   DB_HOST=your-production-db.com
   DB_PORT=5432
   DB_USERNAME=prod_user
   DB_PASSWORD=strong_password
   PORT=3000
   ```

2. **Frontend** - Update `social-pulse-dashboard/.env`:
   ```bash
   VITE_API_BASE_URL=https://api.yourdomain.com
   ```

### Running on Different Ports

If port 3000 is already in use:

1. Change backend port in `backend/.env`:
   ```bash
   PORT=4000
   ```

2. Update frontend to match in `social-pulse-dashboard/.env`:
   ```bash
   VITE_API_BASE_URL=http://localhost:4000
   ```

### Team Development

Each developer can have their own `.env` files:

- `.env` files are in `.gitignore` (not committed)
- `.env.example` files show what variables are needed
- Each developer copies `.env.example` to `.env` and customizes

## No Code Changes Needed!

✅ All configuration is in `.env` files  
✅ No need to edit source code  
✅ Easy to deploy to different environments  
✅ Credentials stay secure (not in git)
