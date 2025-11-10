# Knovy

Knovy is a powerful AI assistant platform with desktop and web applications for real-time audio analysis, transcription, and AI-powered interactions.

## Project Overview

Knovy combines Google's Generative AI (Gemini) with local transcription to provide intelligent assistance during meetings and conversations. The platform consists of four main applications:

1. **Desktop App (Electron)**: Cross-platform desktop application with local whisper.cpp transcription, dual-stream audio capture (microphone + system audio), progressive enhancement, and AI-powered insights.

2. **Web Application (Next.js)**: Marketing website with product information and waitlist/beta invitation system.

3. **Admin Dashboard (Next.js)**: Internal platform for user administration, role assignment, usage analytics, and release management.

4. **Backend Services (Supabase)**: Serverless backend with authentication, RBAC system, and Edge Functions for AI actions.

## Repository Structure

This is a monorepo managed with pnpm workspaces and Turborepo.

```
/
├── apps/
│   ├── app/                   # Electron + Vite desktop application (main app)
│   ├── web/                   # Next.js marketing and demo website
│   ├── admin-dashboard/       # Admin management interface
│   └── proxy/                 # WebSocket proxy server for web demos (not used after replacing the demo section with video)
├── packages/
│   ├── ui/                    # Shared React components (shadcn/ui + Radix + Tailwind)
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
- Supabase CLI (for backend development)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/knovy.git
   cd knovy
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up Supabase**

   ```bash
   supabase start
   supabase status  # Get local API keys
   supabase functions serve --env-file supabase/.env.development
   ```

4. **Set up environment variables**

   Copy `.env.example` to `.env` in each application directory and fill in required API keys:
   - `apps/app/.env` - Desktop app configuration
   - `apps/web/.env` - Web app configuration
   - `apps/admin-dashboard/.env` - Admin dashboard configuration
   - `apps/proxy/.env` - Proxy server configuration (if needed)

   Get Google Generative AI API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

5. **Start development**

   **Desktop Application** (recommended):
   ```bash
   cd apps/app
   pnpm dev
   ```
   The app will automatically download the small whisper model (488MB) on first launch.

   **Web Application**:
   ```bash
   cd apps/web
   pnpm dev
   ```

   **Admin Dashboard**:
   ```bash
   cd apps/admin-dashboard
   pnpm dev
   ```

## Key Features

### Desktop Application

- **Local Transcription**: Privacy-focused speech-to-text using whisper.cpp (runs offline)
- **Dual-Stream Audio**: Simultaneous microphone and system audio capture
- **Two-Stage Language Detection**: Improved accuracy for Traditional Chinese
- **Progressive Enhancement**: Raw transcription displayed immediately, AI-enhanced version follows
- **AI Actions**: Summarize, chat, keyword search, screenshot analysis, deep response, recommendations
- **RBAC System**: Role-based feature access and usage quotas
- **Chinese Language Support**: Automatic Traditional/Simplified conversion via OpenCC

### Web Application

- Marketing website with product showcase
- Waitlist and beta invitation management
- Responsive design with modern UI components

### Admin Dashboard

- User management and role assignment (free, pro, admin)
- Usage analytics with Tremor charts
- Release management and beta invitations
- Audit logging

### Backend Services

- **Authentication**: JWT-based auth with OAuth support
- **RBAC & Entitlements**: Granular feature control and quota management
- **AI Actions**: `ai-action-summarize`, `ai-action-chat`, `ai-action-keyword`, `ai-action-deep-response`, `ai-action-recommend-response`, `ai-action-screenshot-response`
- **User Management**: `get-session-profile`, `get-latest-release`, `send-beta-invitation`, `add-to-waitlist`

## Architecture Highlights

- **Serverless Backend**: Supabase Edge Functions (Deno) with JWT authentication
- **RBAC System**: Role-based access with feature entitlements and usage quotas
- **Progressive Enhancement**: ID-based updates prevent duplicate transcriptions
- **Chinese Language Support**: OpenCC integration for Traditional ↔ Simplified conversion
- **Release Management**: Automated updates with GitHub Actions CI/CD

## Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[Architecture Overview](docs/architecture/overview.md)**: System architecture and transcription flow
- **[Development Setup](docs/setup/development.md)**: Detailed setup instructions
- **[RBAC & Entitlements](docs/architecture/RBAC.md)**: Role-based access control
- **[Edge Functions API](docs/api/edge-functions.md)**: Complete API specification
- **[Whisper Integration](docs/architecture/whisper.md)**: Local transcription architecture
- **[Message Threading](docs/architecture/Message-threading.md)**: Speaker identification
- **[Waitlist to Beta Conversion](docs/waitlist-to-beta-conversion-implementation.md)**: Beta workflow

## Release Process

Desktop app releases are automated via GitHub Actions and published to [Knovy-Release](https://github.com/Intevia-AI/Knovy-Release).

1. Update version in `apps/app/package.json`
2. Create and push git tag:
   ```bash
   git tag v0.3.7
   git push origin v0.3.7
   ```
3. GitHub Action builds, signs (macOS), and publishes release
4. Desktop app automatically notifies users of new versions

**Code Signing**: Requires Apple Developer credentials in repository secrets (see `.github/workflows/release.yml`).

## Development Commands

```bash
# Monorepo management
pnpm install              # Install all dependencies
pnpm dev                  # Start all development servers
pnpm build                # Build all applications
pnpm lint                 # Run linting
pnpm format               # Format code

# Desktop app
cd apps/app
pnpm dev                  # Start development
pnpm build:local          # Build locally (unsigned)

# Web app
cd apps/web
pnpm dev                  # Start development
pnpm build                # Build for production

# Admin dashboard
cd apps/admin-dashboard
pnpm dev                  # Start development
pnpm build                # Build for production

# Proxy server (if needed)
cd apps/proxy
pnpm start                # Start WebSocket proxy

# Supabase
supabase start            # Start local services
supabase status           # Get API keys
supabase functions serve  # Start Edge Functions
supabase db reset         # Reset local database
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, coding standards, and pull request process.
