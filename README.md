# Intevia AI

A powerful AI assistant platform with desktop and web applications for real-time audio analysis, transcription, and AI-powered interactions.

## Project Overview

Intevia AI is a comprehensive platform that combines the power of Google's Generative AI (Gemini) with real-time audio processing to provide intelligent assistance during meetings, presentations, and conversations. The platform consists of three main applications:

1. **Desktop App (Electron)**: A cross-platform desktop application that captures audio, provides real-time transcription, and offers AI-powered insights.
2. **Web Application (Next.js)**: A browser-based version with similar capabilities, accessible from any device.
3. **Proxy Server**: A WebSocket server that handles secure communication with Google's Generative AI services.

## Technology Stack

### Core Technologies
- **Frontend**: React 19, Next.js 15
- **Desktop**: Electron 35
- **Backend**: Node.js (v20+)
- **AI Integration**: Google Generative AI (Gemini)
- **Audio Processing**: Web Audio API, WebRTC
- **Authentication**: Supabase
- **Package Management**: pnpm
- **Build System**: Turborepo

### Key Features
- Real-time audio transcription
- AI-powered conversation analysis
- Meeting integration (Zoom, Google Meet, Microsoft Teams, Webex)
- Screen sharing and capture
- Voice activation with wake word detection

## Repository Structure

This is a monorepo managed with pnpm workspaces and Turborepo:

```
intevia-ai/
├── apps/                      # Application packages
│   ├── app/                   # Electron desktop application
│   ├── web/                   # Next.js web application
│   └── proxy/                 # WebSocket proxy server
├── packages/                  # Shared packages
│   ├── eslint-config/         # ESLint configurations
│   ├── typescript-config/     # TypeScript configurations
│   └── ui/                    # Shared UI components
├── scripts/                   # Utility scripts
│   └── setup-env.sh           # Environment setup script
└── docs/                      # Documentation
    ├── setup/                 # Setup guides
    ├── architecture/          # Architecture documentation
    └── deployment/            # Deployment guides
```

## Quick Start

### Prerequisites
- Node.js v20 or later
- pnpm v10 or later
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/intevia-ai.git
   cd intevia-ai
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   # Run the automated setup script
   bash scripts/setup-env.sh
   
   # Edit the .env files in each application directory with your actual values
   # - apps/app/.env
   # - apps/web/.env
   # - apps/proxy/.env
   ```

4. **Start the development servers**

   For the web application:
   ```bash
   # Terminal 1: Start the web application
   cd apps/web
   pnpm dev
   
   # Terminal 2: Start the proxy server
   cd apps/web
   pnpm proxy
   ```

   For the desktop application:
   ```bash
   cd apps/app
   pnpm dev
   ```

## Application Setup

### Web Application

The web application runs on Next.js and provides a browser-based interface for Intevia AI.

```bash
cd apps/web
pnpm dev     # Start Next.js development server
pnpm proxy   # Start WebSocket proxy server
```

Access the web application at http://localhost:3000

### Desktop Application

The desktop application is built with Electron and provides a native experience across platforms.

```bash
cd apps/app
pnpm dev     # Start Electron development
pnpm build   # Build desktop applications for distribution
```

### Proxy Server

The proxy server can be run standalone if needed:

```bash
cd apps/proxy
pnpm start   # Start the WebSocket proxy server
```

## Docker Deployment

The project includes Docker configuration for containerized deployment:

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

The web application will be available at http://localhost:3456

## Environment Configuration

Each application requires specific environment variables:

- **Web Application**: Google AI API key, email configuration, proxy URL
- **Desktop Application**: WebSocket URL, API endpoint, Supabase credentials
- **Proxy Server**: Google AI API key, port configuration

Refer to the `.env.example` files in each application directory for detailed information.

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is proprietary software. All rights reserved.

## Support

For support, please contact the Intevia AI team at support@example.com.