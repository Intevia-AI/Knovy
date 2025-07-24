# Docker Setup Guide

> [!IMPORTANT]
> This document is AI generated. Please verify the information before using it.

## Overview

This guide covers the Docker containerization setup for the Intevia AI project. The project uses Docker to provide a consistent development and deployment environment across different platforms.

## Container Architecture

The Intevia AI project currently consists of the following services:

### Containerized Services

#### Web Application (Next.js)

- **Service Name**: `web`
- **Base Image**: Node.js 22 Alpine
- **Exposed Port**: 3000 (mapped to host port 3456)
- **Purpose**: Serves the main web application with AI transcription capabilities
- **Dependencies**: FFmpeg for audio processing
- **Status**: ✅ Containerized

### Non-Containerized Services

#### Proxy Server (WebSocket)

- **Service Name**: `proxy` (potential)
- **Base Image**: Node.js 18 Alpine (Dockerfile available)
- **Exposed Port**: 4567
- **Purpose**: WebSocket proxy for Google Gemini AI API communication
- **Status**: 🔄 Dockerfile ready, not yet integrated into docker-compose.yml

### Network Architecture

```
┌─────────────────────────────────────────┐
│              Host System                │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │         Docker Network              ││
│  │         (my_network)                ││
│  │                                     ││
│  │  ┌─────────────────────────────────┐││
│  │  │        Web Service              │││
│  │  │      (Next.js App)              │││
│  │  │                                 │││
│  │  │  Port: 3000 → Host: 3456        │││
│  │  │  Memory: 4GB limit              │││
│  │  │  Platform: linux/amd64          │││
│  │  └─────────────────────────────────┘││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │     Proxy Server (Host Process)     ││
│  │                                     ││
│  │  Port: 4567                         ││
│  │  Status: Running on host            ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

## Prerequisites

Before setting up Docker containers, ensure you have:

1. **Docker Engine** (version 20.10 or later)
2. **Docker Compose** (version 2.0 or later)
3. **Environment Configuration** (see Environment Variables section)

### Installing Docker

#### macOS

```bash
# Using Homebrew
brew install --cask docker

# Or download Docker Desktop from https://docker.com
```

#### Linux (Ubuntu/Debian)

```bash
# Install Docker Engine
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

#### Windows

Download and install Docker Desktop from [https://docker.com](https://docker.com)

## Environment Variables

### Required Environment Variables

The Docker containers require specific environment variables to function properly. These should be configured in the `.env` files for each application.

#### Web Application (.env file location: `apps/web/.env`)

```bash
# Google Gemini AI API Configuration
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here

# Email Configuration (for feedback system)
GMAIL_USER=your_gmail_address@gmail.com
GMAIL_PASS=your_gmail_app_password

# Proxy Server Configuration
PROXY_SERVER_URL=ws://localhost:4567

# Environment Mode
NODE_ENV=production
```

### Environment Variable Handling in Containers

1. **Build-time Variables**: Passed via `ARG` instructions in Dockerfiles
2. **Runtime Variables**: Loaded from `.env` files via `env_file` directive
3. **Override Variables**: Set directly in `docker-compose.yml` environment section

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd intevia-ai

# Setup environment variables
./scripts/setup-env.sh
```

### 2. Configure Environment Variables

Edit the environment files with your actual values:

```bash
# Edit web application environment
nano apps/web/.env
```

### 3. Build and Start Services

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up --build -d
```

### 4. Access the Application

- **Web Application**: http://localhost:3456
- **Health Check**: Verify containers are running with `docker-compose ps`

## Development Workflow

### Building Images

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build web

# Build with no cache (clean build)
docker-compose build --no-cache
```

### Managing Services

```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Restart specific service
docker-compose restart web
```

### Viewing Logs

```bash
# View all service logs
docker-compose logs

# View specific service logs
docker-compose logs web

# Follow logs in real-time
docker-compose logs -f web

# View last 100 lines
docker-compose logs --tail=100 web
```

## Container Configuration Details

### Web Service Configuration

#### Memory Management

- **Memory Limit**: 4GB (`mem_limit: 4g`)
- **Swap Limit**: 6GB (`memswap_limit: 6g`)
- **Purpose**: Prevents containers from consuming excessive host resources

#### Platform Specification

- **Platform**: `linux/amd64`
- **Purpose**: Ensures consistent behavior across different host architectures (Intel/AMD64)

#### Restart Policy

- **Policy**: `unless-stopped`
- **Behavior**: Container automatically restarts unless explicitly stopped by user

#### Network Configuration

- **Network**: Custom bridge network (`my_network`)
- **Benefits**:
  - Isolated network namespace
  - Service discovery via container names
  - Secure inter-service communication

## Volume Management

### Current Volume Strategy

The current setup uses bind mounts for environment files:

- Environment files are mounted from host to container
- No persistent data volumes are currently configured

### Adding Persistent Volumes (Future Enhancement)

```yaml
# Example volume configuration for future use
volumes:
  - ./data:/app/data # Application data
  - ./logs:/app/logs # Application logs
  - node_modules:/app/node_modules # Node.js dependencies cache
```

## Security Considerations

### Container Security

1. **Non-root User**: Containers run as non-root user (`nextjs:nodejs`)
2. **Minimal Base Image**: Alpine Linux for reduced attack surface
3. **Environment Isolation**: Sensitive data in environment files, not in images
4. **Network Isolation**: Custom bridge network isolates containers

### Environment Security

1. **API Keys**: Store in `.env` files, never in Dockerfiles or images
2. **File Permissions**: Ensure `.env` files have restricted permissions (600)
3. **Image Scanning**: Regularly scan images for vulnerabilities

## Performance Optimization

### Build Optimization

1. **Multi-stage Builds**: Separate build and runtime stages
2. **Layer Caching**: Optimize Dockerfile layer order for better caching
3. **Dependency Caching**: Use cache mounts for package managers

### Runtime Optimization

1. **Memory Limits**: Prevent OOM conditions with appropriate limits
2. **Resource Monitoring**: Monitor container resource usage
3. **Health Checks**: Implement health checks for service reliability

## Adding Proxy Server to Docker Setup

Currently, the proxy server runs as a host process, but it has a ready Dockerfile for containerization. To integrate it into the Docker setup:

### Option 1: Add Proxy Service to docker-compose.yml

```yaml
services:
  web:
    # ... existing web configuration ...
    depends_on:
      - proxy

  proxy:
    build:
      context: ./apps/proxy
      dockerfile: Dockerfile
    ports:
      - "4567:4567"
    environment:
      - NODE_ENV=production
      - PROXY_PORT=4567
    restart: unless-stopped
    networks:
      - my_network
    platform: linux/amd64
    mem_limit: 512m
    memswap_limit: 1g
    env_file:
      - ./apps/proxy/.env
```

### Option 2: Update Web App Configuration

If containerizing the proxy, update the web app's proxy URL:

```bash
# In apps/web/.env
PROXY_SERVER_URL=ws://proxy:4567  # Use service name instead of localhost
```

### Benefits of Containerizing Proxy

1. **Consistent Environment**: Same runtime environment across development and production
2. **Service Discovery**: Web app can connect using service name (`proxy:4567`)
3. **Resource Management**: Memory and CPU limits for better resource control
4. **Scaling**: Easier to scale proxy instances if needed
5. **Isolation**: Better security isolation between services

## Integration with Development Tools

### IDE Integration

Most modern IDEs support Docker development:

- **VS Code**: Docker extension for container management
- **IntelliJ/WebStorm**: Built-in Docker support
- **Vim/Neovim**: Docker plugins available

### Debugging in Containers

```bash
# Execute shell in running container
docker-compose exec web sh

# Run one-off commands
docker-compose run web npm run test

# Debug with Node.js inspector
docker-compose run -p 9229:9229 web node --inspect=0.0.0.0:9229 server.js

# Debug proxy server (if containerized)
docker-compose run -p 9230:9229 proxy node --inspect=0.0.0.0:9229 startProxy.js
```

## Next Steps

After setting up Docker:

1. Review the [Troubleshooting Guide](./troubleshooting.md) for common issues
2. Check the [Development Guide](./development.md) for development workflow
3. See [API Reference](../architecture/api-reference.md) for API documentation

## Related Documentation

- [Development Setup](./development.md)
- [Troubleshooting Guide](./troubleshooting.md)
- [Architecture Overview](../architecture/overview.md)
