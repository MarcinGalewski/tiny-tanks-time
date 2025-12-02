#!/bin/bash
# Tiny Tanks Time - Deployment Script
# This script automates the deployment process

set -e

echo "🚀 Tiny Tanks Time - Deployment Script"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is installed${NC}"

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker Compose is installed${NC}"

# Pull latest code
echo -e "\n${YELLOW}📥 Pulling latest code from main branch...${NC}"
git checkout main
git pull origin main

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please update .env file with your server configuration${NC}"
    read -p "Press enter after updating .env file..."
fi

# Build Docker image
echo -e "\n${YELLOW}🐳 Building Docker image...${NC}"
docker-compose build

# Stop existing container if running
echo -e "\n${YELLOW}⏹️  Stopping existing container (if any)...${NC}"
docker-compose down || true

# Start the application
echo -e "\n${YELLOW}▶️  Starting application...${NC}"
docker-compose up -d

# Wait for container to be healthy
echo -e "\n${YELLOW}⏳ Waiting for container to be healthy...${NC}"
sleep 10

# Check if container is running
if docker-compose ps | grep -q "tiny-tanks-app.*Up"; then
    echo -e "\n${GREEN}✅ Deployment successful!${NC}"
    echo -e "${GREEN}Frontend: http://localhost:4200${NC}"
    echo -e "${GREEN}Backend API: http://localhost:3000${NC}"
    echo -e "\n${YELLOW}📋 View logs with: docker-compose logs -f${NC}"
else
    echo -e "\n${RED}❌ Deployment failed. Check logs:${NC}"
    docker-compose logs tiny-tanks-app
    exit 1
fi
