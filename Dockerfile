# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage - single image serving both backend and frontend
FROM node:20-alpine AS production
WORKDIR /app

# Install http-server for frontend serving
RUN npm install -g http-server

# Copy backend dist and dependencies
COPY --from=builder /app/dist/apps/server ./dist/server
COPY --from=builder /app/package.json /app/package-lock.json ./

# Copy frontend dist
COPY --from=builder /app/dist/apps/tiny-tanks-time/browser ./public/frontend

# Install production dependencies only
RUN npm ci --omit=dev

# Expose ports
EXPOSE 3000 4200

# Start both backend and frontend
CMD ["sh", "-c", "node dist/server/main.js & http-server ./public/frontend -p 4200 -g && wait"]
