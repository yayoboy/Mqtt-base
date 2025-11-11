# MQTT Telemetry Server (TypeScript/Node.js) - Dockerfile
# Multi-stage build for optimized image size

# Stage 1: Build React Web GUI
FROM node:20-alpine AS web-builder

WORKDIR /app/web

# Copy web app files
COPY web/package*.json ./
RUN npm ci

COPY web/ ./

# Build React app
RUN npm run build

# Stage 2: Build TypeScript Server
FROM node:20-alpine AS server-builder

WORKDIR /app

# Copy server files
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built server from builder
COPY --from=server-builder /app/dist ./dist

# Copy built React web GUI from web-builder
COPY --from=web-builder /app/web/../public/app ./public/app

# Copy static files
COPY public/ ./public/

# Copy config and schemas
COPY config.example.yaml ./config.yaml
COPY schemas/ ./schemas/

# Create data directory
RUN mkdir -p /app/data && chown -R node:node /app/data

# Use non-root user
USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Run the application
CMD ["node", "dist/index.js"]
