#!/bin/bash

# Social Pulse Deployment Script
# This script deploys the application to the VPS

set -e  # Exit on error

# Configuration
VPS_HOST="102.213.70.122"
VPS_PORT="2256"
VPS_USER="media"
VPS_PASS="Admin@1234"
DEPLOY_DIR="/home/media/social-pulse"

echo "🚀 Starting deployment to $VPS_HOST..."

# Step 1: Create deployment package
echo "📦 Creating deployment package..."
tar -czf social-pulse-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='backend/storage' \
    backend/ social-pulse-dashboard/ DEPLOYMENT.md CONFIGURATION.md

echo "✅ Package created: social-pulse-deploy.tar.gz"

# Step 2: Upload to VPS
echo "📤 Uploading to VPS..."
sshpass -p "$VPS_PASS" scp -P $VPS_PORT social-pulse-deploy.tar.gz $VPS_USER@$VPS_HOST:~/

echo "✅ Upload complete"

# Step 3: Deploy on VPS
echo "🔧 Deploying on VPS..."
sshpass -p "$VPS_PASS" ssh -p $VPS_PORT $VPS_USER@$VPS_HOST << 'ENDSSH'
    set -e
    
    echo "📂 Extracting files..."
    mkdir -p ~/social-pulse
    cd ~/social-pulse
    tar -xzf ~/social-pulse-deploy.tar.gz
    
    echo "📦 Installing backend dependencies..."
    cd ~/social-pulse/backend
    npm install --production
    
    echo "📦 Installing frontend dependencies..."
    cd ~/social-pulse/social-pulse-dashboard
    npm install
    
    echo "🏗️  Building frontend..."
    npm run build
    
    echo "🔄 Restarting backend..."
    cd ~/social-pulse/backend
    pm2 delete social-pulse-backend 2>/dev/null || true
    pm2 start npm --name "social-pulse-backend" -- run start:prod
    pm2 save
    
    echo "✅ Deployment complete!"
    pm2 status
ENDSSH

echo "🎉 Deployment successful!"
echo ""
echo "Access your application:"
echo "  Frontend: http://$VPS_HOST"
echo "  Backend:  http://$VPS_HOST:3000"
echo ""
echo "To check logs: ssh -p $VPS_PORT $VPS_USER@$VPS_HOST 'pm2 logs social-pulse-backend'"
