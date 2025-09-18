# Intevia AI WebSocket Proxy Server

> [!IMPORTANT]
> This document is AI generated. Please verify the information before using it.

A lightweight, high-performance WebSocket proxy server that facilitates real-time communication between client applications and Google's Gemini AI API. Built with Node.js and WebSocket technology, this server handles audio transcription, AI interactions, and provides secure API key management for the Intevia AI platform.

## Overview

The Intevia AI Proxy Server acts as an intelligent intermediary between client applications (Electron desktop app and web application) and Google's Gemini AI services. It manages WebSocket connections, handles real-time audio streaming, and provides advanced features like rate limiting, connection management, and automatic cleanup of inactive sessions.

### Key Features

- **Real-time WebSocket Communication**: Bidirectional communication with multiple concurrent clients
- **Google Gemini AI Integration**: Direct integration with Gemini 2.0 Flash Live model for audio processing
- **Rate Limiting**: IP-based connection limiting to prevent abuse and ensure fair usage
- **Connection Management**: Automatic cleanup of inactive connections and resource management
- **Multi-mode Support**: Supports both transcription and conversational AI modes
- **Custom Prompts**: Allows clients to set custom system prompts for specialized AI behavior
- **Language Support**: Configurable language preferences for AI responses
- **Security**: Environment-based API key management and secure WebSocket connections

### Architecture

```
Client Applications ↔ WebSocket Proxy Server ↔ Google Gemini AI API
     (Electron/Web)           (Node.js)              (Real-time AI)
```

The proxy server maintains persistent WebSocket connections to both clients and the Gemini API, enabling real-time audio streaming and immediate AI responses without the overhead of HTTP request/response cycles.

### Technology Stack

- **Node.js** (v18+): JavaScript runtime for server-side execution
- **WebSocket (ws)**: High-performance WebSocket library for real-time communication
- **Google Gemini AI**: Advanced AI model for audio transcription and conversation
- **Docker**: Containerization for consistent deployment across environments
- **Alpine Linux**: Lightweight container base for minimal attack surface

## Prerequisites

Before setting up the proxy server, ensure you have:

- **Node.js** (v18 or higher)
- **npm** or **pnpm** - Package manager
- **Google AI API Key** - For Gemini AI integration
- **Docker** (optional) - For containerized deployment
- **Network Access** - Outbound HTTPS/WSS connections to Google APIs

## Installation & Setup

### 1. Local Development Setup

```bash
# Navigate to the proxy directory
cd apps/proxy

# Install dependencies
npm install
# or
pnpm install
```

### 2. Environment Configuration

```bash
# Copy the environment template
cp .env.example .env

# Edit the .env file with your configuration
# Required variables:
# - GOOGLE_GENERATIVE_AI_API_KEY: Your Google AI API key
# - PROXY_PORT: Port for the WebSocket server (default: 4567)
```

### 3. Google AI API Setup

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key or use an existing one
3. Add the key to your `.env` file as `GOOGLE_GENERATIVE_AI_API_KEY`
4. Ensure your Google Cloud project has the Generative Language API enabled

## Development

### Running in Development Mode

```bash
# Start the proxy server
npm start
# or
pnpm start

# The server will start on the configured port (default: 4567)
# WebSocket endpoint: ws://localhost:4567
```

### Development Workflow

1. **Server Code**: Modify `startProxy.js` for server logic changes
2. **Configuration**: Update `.env` for environment-specific settings
3. **Testing**: Use WebSocket clients or browser tools to test connections
4. **Debugging**: Enable debug logging by setting `DEBUG=true` in `.env`

### Project Structure

```
apps/proxy/
├── startProxy.js           # Main server application
├── package.json           # Dependencies and scripts
├── .env.example           # Environment variable template
├── .env                   # Local environment configuration (not in git)
├── Dockerfile             # Container build configuration
├── docker-compose.yml     # Docker orchestration
└── README.md              # This documentation
```

### Key Components

- **`startProxy.js`**: Main server file containing all WebSocket logic, client management, and Gemini API integration
- **Environment Validation**: Automatic validation of required environment variables on startup
- **Rate Limiting**: IP-based connection limiting with configurable windows and limits
- **Client Management**: Connection tracking, activity monitoring, and automatic cleanup

## API Reference

### WebSocket Connection

Connect to the proxy server using WebSocket:

```javascript
const ws = new WebSocket("ws://localhost:4567");
```

### Message Types

#### Client to Server Messages

**Set Operation Mode**

```json
{
  "type": "mode",
  "mode": "transcription" | "conversation"
}
```

**Set Custom Prompt**

```json
{
  "type": "custom_prompt",
  "prompt": "Your custom system prompt here"
}
```

**Set Language Preference**

```json
{
  "type": "language",
  "language": "zh-TW" | "en-US" | "ja-JP"
}
```

**Send Audio Data**

```json
{
  "type": "media_chunk",
  "chunk": "base64-encoded-audio-data",
  "mimeType": "audio/webm;codecs=opus"
}
```

**Disconnect**

```json
{
  "type": "disconnect"
}
```

#### Server to Client Messages

**Setup Complete**

```json
{
  "setupComplete": true
}
```

**AI Response**

```json
{
  "text": "Transcribed or AI-generated text",
  "turnComplete": false
}
```

**Turn Complete**

```json
{
  "text": "Final response",
  "turnComplete": true
}
```

**Error**

```json
{
  "error": "Error description"
}
```

## Docker Deployment

### Building the Container

```bash
# Build the Docker image
docker build -t intevia-proxy .

# Or use Docker Compose
docker-compose build
```

### Running with Docker Compose

```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f proxy-server

# Stop the service
docker-compose down
```

### Environment Variables for Docker

Create a `.env` file in the proxy directory:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key-here
PROXY_PORT=4567
NODE_ENV=production
```

### Docker Configuration

The Docker setup includes:

- **Alpine Linux base**: Minimal attack surface and small image size
- **Non-root user**: Security best practice for container execution
- **Health checks**: Automatic container health monitoring
- **Production optimizations**: Memory limits and Node.js performance tuning

## Production Deployment

### Deployment Considerations

1. **Reverse Proxy**: Use nginx or similar for SSL termination and load balancing
2. **Process Management**: Consider PM2 or similar for process monitoring
3. **Monitoring**: Implement logging and monitoring for production use
4. **Scaling**: Deploy multiple instances behind a load balancer for high availability

### Example nginx Configuration

```nginx
upstream proxy_backend {
    server localhost:4567;
    # Add more servers for load balancing
    # server localhost:4568;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    # SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://proxy_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Environment Variables for Production

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your-production-api-key
PROXY_PORT=4567
NODE_ENV=production
PROXY_HOST=0.0.0.0  # Accept connections from any IP
DEBUG=false
```

## Performance & Scaling

### Performance Characteristics

- **Concurrent Connections**: Supports hundreds of concurrent WebSocket connections
- **Memory Usage**: ~50-100MB base memory usage, scales with active connections
- **CPU Usage**: Low CPU usage for typical workloads, scales with audio processing
- **Network**: Optimized for real-time audio streaming with minimal latency

### Scaling Strategies

1. **Horizontal Scaling**: Deploy multiple proxy instances behind a load balancer
2. **Connection Pooling**: Implement connection pooling for Gemini API connections
3. **Caching**: Cache frequently used AI responses to reduce API calls
4. **Resource Limits**: Configure appropriate memory and CPU limits in production

### Monitoring Metrics

- Active WebSocket connections
- Gemini API response times
- Error rates and types
- Memory and CPU usage
- Network throughput

## Security Considerations

### API Key Security

- **Environment Variables**: Never hardcode API keys in source code
- **Access Control**: Restrict API key permissions in Google Cloud Console
- **Rotation**: Regularly rotate API keys and update deployment configurations
- **Monitoring**: Monitor API key usage for unusual patterns

### Network Security

- **TLS/SSL**: Use HTTPS/WSS in production environments
- **Firewall**: Restrict inbound connections to necessary ports only
- **Rate Limiting**: Configure appropriate rate limits to prevent abuse
- **IP Whitelisting**: Consider IP restrictions for sensitive deployments

### Container Security

- **Non-root User**: Container runs as non-privileged user
- **Minimal Base**: Alpine Linux reduces attack surface
- **Regular Updates**: Keep base images and dependencies updated
- **Security Scanning**: Regularly scan container images for vulnerabilities

## Contributing

When contributing to the proxy server:

1. **Follow Node.js best practices** for asynchronous programming
2. **Add comprehensive error handling** for all WebSocket operations
3. **Test with multiple concurrent connections** to ensure stability
4. **Update documentation** for any API changes
5. **Consider backward compatibility** when modifying message formats

## Related Documentation

- [Main Project README](../../README.md)
- [Electron App](../app/README.md)
- [Web Application](../web/README.md)
- [Development Setup Guide](../../docs/setup/development.md)
- [Architecture Overview](../../docs/architecture/overview.md)
- [Docker Setup Guide](../../docs/setup/docker.md)
