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

## Local Development with Supabase

This project uses Supabase for authentication and database services. You can run a full Supabase stack locally for development.

### Managing the Local Supabase Environment

- **Start the local Supabase services:**

  ```bash
  pnpm dlx supabase start
  ```

- **Stop the local Supabase services:**

  ```bash
  pnpm dlx supabase stop
  ```

- **View the status and API keys:**
  This command shows the API URLs, keys, and other useful information for your local instance.

  ```bash
  pnpm dlx supabase status
  ```

- **Reset the local database:**
  This will wipe your local database and re-apply all migrations. This is useful when you want to start with a clean slate.

  ```bash
  pnpm dlx supabase db reset
  ```

- **Deploy Supabase Functions**

To deploy the Supabase functions, run the following command from the root of the project:

```bash
supabase functions deploy <function-name(the folder name in supabase/functions)>
# Example: supabase functions deploy add-to-waitlist
```

- **Set the environment variables for the functions**

1. Set the Resend API key

   ```bash
   npx supabase secrets set RESEND_API_KEY=your_resend_api_key_here
   ```

- **Push Database Updates**

To apply any new database migrations, run the following command from the root of the project:

```bash
supabase db push
```

### Deploying Supabase Changes to Production

To deploy your local database changes (like the new `waitlist` table) to your live Supabase project on the cloud, follow these steps:

1.  **Link your local project to your remote Supabase project:**
    You only need to do this once. Find your `Project Ref` in your Supabase project's dashboard (Settings > General).

    ```bash
    pnpm dlx supabase link --project-ref <your-project-ref>
    ```

2.  **Push database migrations:**
    This command will apply any new migrations from your `supabase/migrations` folder to your remote database.

    ```bash
    pnpm dlx supabase db push
    ```

3.  **Set production secrets:**
    Your edge functions might need API keys (like the Resend API key). You should set these securely in your production environment.
    ```bash
    # Example for setting the RESEND_API_KEY
    pnpm dlx supabase secrets set RESEND_API_KEY <your-actual-resend-api-key>
    ```

## Environment Configuration

Each application requires specific environment variables:

- **Web Application**: Google AI API key, email configuration, proxy URL
- **Desktop Application**: WebSocket URL, API endpoint, Supabase credentials
- **Proxy Server**: Google AI API key, port configuration

Refer to the `.env.example` files in each application directory for detailed information.

## Code Style and Linting

This project uses [ESLint](https://eslint.org/) for identifying and reporting on patterns in JavaScript and TypeScript, and [Prettier](https://prettier.io/) for code formatting to ensure a consistent code style across the entire codebase.

### Formatting Code

To automatically format all files according to the project's Prettier configuration, run the following command from the root directory:

```bash
pnpm format
```

### Linting Code

To check for code quality issues and potential errors, run the linter. Many simple errors can be fixed automatically by adding the `--fix` flag.

```bash
# Check for linting errors
pnpm lint

# Automatically fix fixable linting errors
pnpm lint -- --fix
```

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is proprietary software. All rights reserved.

## Support

For support, please contact the Intevia AI team at support@example.com.
