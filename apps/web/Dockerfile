# =========================================================================
# Multi-Stage Dockerfile for Knovy Web Application (Next.js)
# =========================================================================
# This Dockerfile builds the Next.js web application using a multi-stage
# approach to optimize the final image size and security. The build process
# includes three stages: base setup, dependency installation & build, and
# final production runtime.
#
# Key Features:
# - Multi-stage build for optimal image size
# - PNPM package manager with caching
# - FFmpeg integration for audio processing
# - Non-root user for security
# - Next.js standalone output for minimal runtime
# =========================================================================

############################################
# Stage 1: Base Image Setup
############################################
# Establishes the foundation with Node.js and essential environment variables
# Uses Alpine Linux for minimal footprint and security benefits
FROM node:22-alpine AS base

# Build argument to specify which project to build (default: web)
ARG PROJECT=web

# Environment variables for PNPM package manager and Node.js optimization
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NODE_OPTIONS=--max_old_space_size=4096

# NODE_OPTIONS explanation:
# --max_old_space_size=4096: Increases Node.js heap size to 4GB
# This prevents out-of-memory errors during large builds

############################################
# Stage 2: Dependencies Installation & Build
############################################
# Handles dependency installation, caching, and application build process
FROM base AS installer

# Inherit project argument from base stage
ARG PROJECT=web

# Install system dependencies required for the application
# - libc6-compat: Compatibility library for some Node.js native modules
# - ffmpeg: Audio/video processing library for transcription features
RUN apk update && apk add --no-cache libc6-compat ffmpeg

# Set working directory for all subsequent operations
WORKDIR /app

# Copy entire project (filtered by .dockerignore)
# This includes package.json files, source code, and configuration
COPY . .

# Enable and configure PNPM package manager
# Corepack provides version management for package managers
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Install dependencies with caching optimization
# --mount=type=cache: Creates a cache mount for PNPM store
# --frozen-lockfile: Ensures reproducible builds using exact versions
# Cache benefits: Faster subsequent builds, reduced network usage
RUN --mount=type=cache,mode=0777,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Navigate to the specific application directory
WORKDIR /app/apps/${PROJECT}

# Set production environment for optimized build
# This enables Next.js production optimizations and tree shaking
ENV NODE_ENV=production

# Build the Next.js application with build cache optimization
# --mount=type=cache: Caches Next.js build artifacts between builds
# This significantly speeds up subsequent builds when source hasn't changed
RUN --mount=type=cache,mode=0777,id=nextjs-cache,target=/app/apps/${PROJECT}/.next/cache \
    pnpm run build

############################################
# Stage 3: Production Runtime Image
############################################
# Creates the final minimal image with only runtime dependencies
# Excludes build tools and source code for security and size optimization
FROM node:22-alpine AS runner

# Inherit project argument for consistent configuration
ARG PROJECT=web

# Set working directory for the runtime environment
WORKDIR /app

# Install runtime dependencies and create security-focused user setup
# - libc6-compat: Runtime compatibility for native modules
# - ffmpeg: Required for audio processing at runtime
# - nodejs group (GID 1001): System group for Node.js processes
# - nextjs user (UID 1001): Non-root user for running the application
RUN apk update && apk add --no-cache libc6-compat ffmpeg && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Switch to non-root user for security
# Prevents potential privilege escalation attacks
USER nextjs

# Copy essential configuration files from build stage
# These files are needed for Next.js standalone mode operation
COPY --from=installer /app/apps/${PROJECT}/next.config.mjs .
COPY --from=installer /app/apps/${PROJECT}/package.json .

# Copy the standalone build output from Next.js
# Standalone mode bundles all dependencies into a single directory
# This eliminates the need for node_modules in the final image
COPY --from=installer --chown=nextjs:nodejs /app/apps/${PROJECT}/.next/standalone ./

# Copy static assets that Next.js serves directly
# These include images, fonts, and other public assets
COPY --from=installer --chown=nextjs:nodejs /app/apps/${PROJECT}/.next/static ./apps/${PROJECT}/.next/static

# Copy public directory containing user-uploaded and static assets
COPY --from=installer --chown=nextjs:nodejs /app/apps/${PROJECT}/public ./apps/${PROJECT}/public

# Expose port 3000 for the Next.js application
# This is informational - actual port mapping happens in docker-compose.yml
EXPOSE 3000

# Start the Next.js application using the standalone server
# The standalone server.js includes all necessary dependencies
CMD ["node", "apps/web/server.js"]