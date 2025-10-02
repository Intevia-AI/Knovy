# Knovy

Knovy is a powerful AI assistant platform with desktop and web applications for real-time audio analysis, transcription, and AI-powered interactions.

## Project Overview

Knovy is a comprehensive platform that combines the power of Google's Generative AI (Gemini) with local transcription capabilities to provide intelligent assistance during meetings, presentations, and conversations. The platform consists of three main applications:

1.  **Desktop App (Electron)**: A cross-platform desktop application featuring local whisper.cpp transcription, dual-stream audio capture (microphone + system audio), progressive transcription enhancement, and AI-powered insights.
2.  **Web Application (Next.js)**: A browser-based marketing website and real-time transcription demo.
3.  **Admin Dashboard (Next.js)**: An internal tool for platform management with user role assignment and usage auditing.
4.  **Backend Services (Supabase)**: Serverless backend with authentication, RBAC entitlements system, and secure Edge Functions for AI actions.

## Repository Structure

This is a monorepo managed with pnpm workspaces and Turborepo.

```
/
├── apps/
│   ├── app/                   # Electron + Vite desktop application (main app)
│   ├── history-viewer/        # Next.js app embedded in desktop app
│   ├── web/                   # Next.js marketing and demo website
│   ├── admin-dashboard/       # Admin management interface
│   └── proxy/                 # WebSocket proxy server (web app only)
├── packages/
│   ├── ui/                    # Shared React components (Radix + Tailwind)
│   ├── eslint-config/         # Shared ESLint configurations
│   └── typescript-config/     # Shared TypeScript configurations
├── supabase/                  # Backend: Auth, DB, Edge Functions
└── docs/                      # Architecture and API documentation
```

## Quick Start

### Prerequisites

- Node.js v20 or later
- pnpm v10 or later
- Git

### Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/your-org/knovy.git
    cd knovy
    ```

2.  **Install dependencies**

    ```bash
    pnpm install
    ```

3.  **Set up Supabase**

    For local development, start the Supabase services:

    ```bash
    supabase start
    ```

    Get the local API keys:

    ```bash
    supabase status
    ```

    Start the Supabase Edge Functions:

    ```bash
    supabase functions serve --env-file supabase/.env.development
    ```

4.  **Set up environment variables**

    Copy `.env.example` to `.env` in each application directory:
    - `apps/app/.env.example` → `apps/app/.env`
    - `apps/web/.env.example` → `apps/web/.env`
    - `apps/proxy/.env.example` → `apps/proxy/.env`

    Fill in the required API keys:
    - **Google Generative AI**: Get API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
    - **Supabase**: Use keys from `supabase status` for local development

5.  **Start the development servers**

    **Desktop Application** (recommended):

    ```bash
    pnpm --filter app dev
    ```

    The app will automatically download the base whisper model (142MB) on first launch.

    **Web Application** (demo):

    ```bash
    # Terminal 1: Start the web application
    pnpm --filter web dev

    # Terminal 2: Start the proxy server
    pnpm --filter web proxy
    ```

## Key Features

### Desktop Application

- **Local Transcription**: Privacy-focused speech-to-text using whisper.cpp (runs offline)
- **Dual-Stream Audio**: Simultaneous microphone and system audio capture
- **Two-Stage Language Detection**: Improved accuracy for Traditional Chinese users
- **Progressive Enhancement**: Raw transcription displayed immediately, AI-enhanced version appears 2-5s later
- **AI Actions**: Summarize, chat, keyword search, screenshot analysis
- **RBAC System**: Role-based feature access and usage quotas

### Architecture Highlights

- **Serverless Backend**: Supabase Edge Functions (Deno) with JWT authentication
- **Entitlements System**: Granular feature control via role-based entitlements and quotas
- **Progressive Enhancement Pattern**: ID-based in-place updates prevent duplicate messages
- **Smart Batching**: Efficient API usage for transcription enhancement

## Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[Architecture Overview](docs/architecture/overview.md)**: System architecture and transcription flow
- **[Development Setup](docs/setup/development.md)**: Detailed setup instructions and deployment guides
- **[RBAC & Entitlements](docs/architecture/RBAC.md)**: Role-based access control system
- **[Edge Functions API](docs/api/edge-functions.md)**: Complete API specification
- **[Whisper Integration](docs/architecture/whisper.md)**: Local transcription architecture

## Release Process

Desktop app releases are automated via GitHub Actions and published to [Knovy-Release](https://github.com/Intevia-AI/Knovy-Release).

1. **Update version** in `apps/app/package.json`
2. **Create and push git tag**:
   ```bash
   git tag v0.3.1
   git push origin v0.3.1
   ```
3. **Automated build**: GitHub Action builds, signs (macOS), and publishes release

**Code Signing**: Requires Apple Developer credentials in repository secrets (see `.github/workflows/release.yml`).

## Development Commands

```bash
# Monorepo management
pnpm install              # Install all dependencies
pnpm dev                  # Start all development servers
pnpm build                # Build all applications
pnpm lint                 # Run linting across packages
pnpm format               # Format code with Prettier

# Desktop app
pnpm --filter app dev               # Start development
pnpm --filter app build:local       # Build locally (unsigned)

# Web app
pnpm --filter web dev               # Start development
pnpm --filter web proxy             # Start WebSocket proxy

# Supabase
supabase start                      # Start local services
supabase status                     # Get API keys
supabase functions serve            # Start Edge Functions
supabase db reset                   # Reset local database
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, coding standards, and pull request process.
