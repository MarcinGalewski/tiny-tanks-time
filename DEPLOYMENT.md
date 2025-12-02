# 🚀 Tiny Tanks Time - Production Deployment Guide

This guide will help you deploy the Tiny Tanks Time game to a real server using Docker.

## 📋 Prerequisites

Before you start, ensure you have the following installed on your server:
- **Docker** (v20.0+)
- **Docker Compose** (v2.0+)
- **Git**
- **A domain or server IP** (e.g., 123.45.67.89)

### Install Docker & Docker Compose on Linux

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

---

## 📦 Step 1: Clone the Repository

SSH into your server and clone the latest version:

```bash
# Connect to your server
ssh user@your-server-ip

# Clone the repository
git clone https://github.com/Jackychan0201/tiny-tanks-time.git
cd tiny-tanks-time

# Switch to main branch (ensure you're on the latest)
git checkout main
git pull origin main
```

---

## 🔧 Step 2: Prepare the Environment

```bash
# Copy environment template
cp .env.example .env

# Edit the .env file with your server details
nano .env
```

**Important environment variables to update:**
```env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=http://your-domain.com  # Update with your actual domain
```

---

## 🐳 Step 3: Build and Deploy with Docker

### Option A: Deploy with Docker Compose (Recommended - One Command)

```bash
# Build the Docker image
docker-compose build

# Start the application
docker-compose up -d

# Verify the services are running
docker-compose ps

# View logs
docker-compose logs -f tiny-tanks-app
```

**Expected output:**
```
NAME              STATUS          PORTS
tiny-tanks-app    Up (healthy)    0.0.0.0:3000->3000/tcp, 0.0.0.0:4200->4200/tcp
```

---

### Option B: Manual Docker Deployment

```bash
# Build the image
docker build -t tiny-tanks-time:latest .

# Run the container
docker run -d \
  --name tiny-tanks-app \
  -p 3000:3000 \
  -p 4200:4200 \
  --restart unless-stopped \
  -e NODE_ENV=production \
  -e PORT=3000 \
  tiny-tanks-time:latest

# Check if running
docker ps

# View logs
docker logs -f tiny-tanks-app
```

---

## 🌐 Step 4: Access Your Application

After deployment, your app will be available at:

- **Frontend**: `http://your-server-ip:4200` or `http://your-domain:4200`
- **Backend API**: `http://your-server-ip:3000` or `http://your-domain:3000`
- **WebSocket**: `ws://your-server-ip:3000` or `ws://your-domain:3000`

Test it by opening in your browser:
```
http://your-server-ip:4200
```

---

## 🔐 Step 5: Set Up a Reverse Proxy (Optional but Recommended)

For production, use Nginx as a reverse proxy to serve both frontend and backend on port 80/443.

### Install Nginx

```bash
sudo apt install nginx
```

### Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/tiny-tanks
```

Paste the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or IP

    client_max_body_size 50M;

    # Frontend - Angular app
    location / {
        proxy_pass http://127.0.0.1:4200;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket support
    location /socket.io {
        proxy_pass http://127.0.0.1:3000/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Enable the Configuration

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/tiny-tanks /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

Now access your app on port 80:
```
http://your-domain.com
```

---

## 🔒 Step 6: Set Up HTTPS with Let's Encrypt (Production)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot --nginx -d your-domain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

Your app is now accessible at:
```
https://your-domain.com
```

---

## 📊 Step 7: Monitor and Maintain

### Check Docker Container Status

```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f

# Restart container
docker-compose restart

# Stop container
docker-compose down

# Start container
docker-compose up -d
```

### Update to Latest Version

```bash
cd tiny-tanks-time

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# View logs to ensure it started
docker-compose logs -f
```

---

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find what's using port 3000 or 4200
sudo lsof -i :3000
sudo lsof -i :4200

# Kill the process
sudo kill -9 <PID>
```

### Container Won't Start

```bash
# Check detailed logs
docker-compose logs tiny-tanks-app

# Rebuild without cache
docker-compose build --no-cache
```

### WebSocket Connection Issues

Ensure `CORS_ORIGIN` in `.env` matches your frontend domain:
```env
CORS_ORIGIN=https://your-domain.com
```

### Check Container Health

```bash
docker-compose ps
# Should show "healthy" status
```

---

## 📈 Performance Tips

1. **Use a CDN** for static assets (frontend files)
2. **Enable Gzip compression** in Nginx
3. **Set up monitoring** with Docker stats:
   ```bash
   docker stats tiny-tanks-app
   ```
4. **Use a load balancer** if scaling to multiple instances
5. **Keep Docker images small** - use alpine base images (already done)

---

## 🎮 Test Multiplayer

Once deployed, open multiple browser tabs/windows:
1. Go to `https://your-domain.com`
2. Start the game in both tabs
3. See players syncing in real-time across browsers

---

## 🆘 Need Help?

If you encounter issues:
1. Check logs: `docker-compose logs -f`
2. Verify ports are open: `sudo ufw allow 80,443,3000,4200/tcp`
3. Ensure Git is up to date: `git pull origin main`

---

**You're all set! Your Tiny Tanks Time game is now live! 🎉**
