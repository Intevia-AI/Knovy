# =========================================================================
# Dockerfile for Intevia AI WebSocket Proxy Server
# =========================================================================
# This Dockerfile builds a lightweight container for the WebSocket proxy server
# that facilitates real-time communication between client applications and
# Google's Gemini AI API for audio transcription and AI interactions.
#
# Architecture:
# Client App ↔ WebSocket Proxy ↔ Google Gemini AI API
#
# Key Features:
# - WebSocket server for real-time bidirectional communication
# - Proxy layer for API key management and request routing
# - Lightweight Alpine Linux base for minimal attack surface
# - Production-optimized with minimal dependencies
# =========================================================================

# -------------------------------------------------------------------------
# Base Image Selection
# -------------------------------------------------------------------------
# Use Node.js 18 Alpine as the base image
# Alpine Linux benefits:
# - Minimal size (~5MB base vs ~100MB+ for full Linux distributions)
# - Enhanced security with reduced attack surface
# - Package manager (apk) for additional dependencies if needed
# - Musl libc instead of glibc for better performance in containers
FROM node:18-alpine

# -------------------------------------------------------------------------
# Working Directory Setup
# -------------------------------------------------------------------------
# Set the working directory inside the container
# All subsequent COPY, RUN, and CMD instructions will execute from this directory
# Using /app as a standard convention for application code
WORKDIR /app

# -------------------------------------------------------------------------
# Dependency Installation (Optimized Layer Caching)
# -------------------------------------------------------------------------
# Copy package files first to leverage Docker's layer caching mechanism
# This optimization ensures that dependency installation only re-runs when
# package.json or package-lock.json changes, not when source code changes
COPY package*.json ./

# Install production dependencies only
# --production flag excludes devDependencies to minimize image size
# --ci flag uses package-lock.json for faster, reproducible installs
# --only=production ensures no development tools are included
RUN npm ci --only=production && \
    npm cache clean --force

# Alternative package managers (commented for reference):
# For Yarn: RUN yarn install --frozen-lockfile --production
# For PNPM: RUN pnpm install --frozen-lockfile --prod

# -------------------------------------------------------------------------
# Application Source Code
# -------------------------------------------------------------------------
# Copy the application source code to the container
# This layer will rebuild whenever source code changes
# Use .dockerignore to exclude unnecessary files (node_modules, .git, etc.)
COPY . .

# -------------------------------------------------------------------------
# Security Configuration
# -------------------------------------------------------------------------
# Create a non-root user for running the application
# This follows security best practices by avoiding root privileges
RUN addgroup -g 1001 -S nodejs && \
    adduser -S proxy -u 1001 -G nodejs

# Change ownership of application files to the non-root user
RUN chown -R proxy:nodejs /app

# Switch to the non-root user for all subsequent operations
USER proxy

# -------------------------------------------------------------------------
# Network Configuration
# -------------------------------------------------------------------------
# Expose port 4567 for WebSocket connections
# This is the default port for the proxy server
# Note: This is declarative - actual port mapping is configured in
# docker-compose.yml or docker run command
EXPOSE 4567

# -------------------------------------------------------------------------
# Environment Configuration
# -------------------------------------------------------------------------
# Set default environment variables
# These can be overridden at runtime via:
# - docker-compose.yml environment section
# - docker run -e flag
# - .env files mounted into the container

# Set Node.js environment to production for optimizations
ENV NODE_ENV=production

# Set default proxy server port
ENV PROXY_PORT=4567

# Configure Node.js memory and performance settings
ENV NODE_OPTIONS="--max-old-space-size=512"

# -------------------------------------------------------------------------
# Health Check Configuration
# -------------------------------------------------------------------------
# Add health check to monitor container status
# This helps orchestration tools (Docker Compose, Kubernetes) determine
# if the container is healthy and ready to receive traffic
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:${PROXY_PORT}/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# -------------------------------------------------------------------------
# Container Startup Command
# -------------------------------------------------------------------------
# Define the command to run when the container starts
# Using exec form (JSON array) for better signal handling
# This ensures proper process management and graceful shutdowns
CMD ["node", "startProxy.js"]

# Alternative startup options (commented for reference):
# For development with auto-restart: CMD ["nodemon", "startProxy.js"]
# For PM2 process management: CMD ["pm2-runtime", "start", "startProxy.js"]
# For debugging: CMD ["node", "--inspect=0.0.0.0:9229", "startProxy.js"]

