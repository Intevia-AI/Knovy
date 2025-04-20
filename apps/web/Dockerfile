############################################
# Stage 1: Base image
############################################
FROM node:22-alpine AS base
ARG PROJECT=web
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NODE_OPTIONS=--max_old_space_size=4096

############################################
# Stage 2: Install dependencies and build
############################################
FROM base AS installer
ARG PROJECT=web
# Install any OS dependencies needed (here, libc6-compat for some binaries)
# Add ffmpeg here
RUN apk update && apk add --no-cache libc6-compat ffmpeg
WORKDIR /app
# Copy all files – use a proper .dockerignore to avoid copying unnecessary files
COPY . .

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Use a cache mount for the pnpm store, configure it to use copy-import mode, and install deps
RUN --mount=type=cache,mode=0777,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Change directory to the workspace (app) you want to build.
WORKDIR /app/apps/${PROJECT}
# Set production environment for the build
ENV NODE_ENV=production
# Use a cache mount for Next.js' build cache to speed up repeated builds
RUN --mount=type=cache,mode=0777,id=nextjs-cache,target=/app/apps/${PROJECT}/.next/cache \
    pnpm run build

############################################
# Stage 3: Final production image
############################################
FROM node:22-alpine AS runner
ARG PROJECT=web
WORKDIR /app

# Install runtime OS dependencies and create a non-root user
# Add ffmpeg here
RUN apk update && apk add --no-cache libc6-compat ffmpeg && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
USER nextjs

# Copy configuration files if needed
COPY --from=installer /app/apps/${PROJECT}/next.config.mjs .
COPY --from=installer /app/apps/${PROJECT}/package.json .

# Copy the standalone build output. In Next.js standalone mode, the build places server.js
# and all required files in the .next/standalone directory.
COPY --from=installer --chown=nextjs:nodejs /app/apps/${PROJECT}/.next/standalone ./

# Copy static assets – adjust paths as needed
COPY --from=installer --chown=nextjs:nodejs /app/apps/${PROJECT}/.next/static ./apps/${PROJECT}/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/${PROJECT}/public ./apps/${PROJECT}/public

EXPOSE 3000

# Use the environment variable in the CMD instruction
CMD ["node", "apps/web/server.js"]