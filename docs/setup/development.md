# Development Environment Setup

> [!IMPORTANT]
> This document is AI generated. Please verify the information before using it.

This guide provides detailed instructions for setting up your development environment for the Intevia AI project.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 20.0.0 or later

  - [Download Node.js](https://nodejs.org/)
  - Verify with: `node --version`

- **pnpm**: Version 10.0.0 or later

  - Install with: `npm install -g pnpm`
  - Verify with: `pnpm --version`

- **Git**: Latest version recommended

  - [Download Git](https://git-scm.com/downloads)
  - Verify with: `git --version`

- **Code Editor**: VSCode, Cursor or Kiro
  - Recommended extensions:
    - ESLint
    - Prettier
    - TypeScript and JavaScript Language Features
    - Docker

## Setting Up the Repository

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/intevia-ai.git
   cd intevia-ai
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

   This will install all dependencies for the monorepo, including all applications and shared packages.

3. **Set up environment variables**

   ```bash
   bash scripts/setup-env.sh
   ```

   This script will copy all `.env.example` files to `.env` files in each application directory. You'll need to edit these files with your actual values.

## Required API Keys and Services

### Google Generative AI (Gemini)

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Add the key to:
   - `apps/web/.env`: `GOOGLE_GENERATIVE_AI_API_KEY`
   - `apps/proxy/.env`: `GOOGLE_GENERATIVE_AI_API_KEY`

### Supabase (Optional for Authentication)

1. Create a new project at [Supabase](https://supabase.com/)
2. Navigate to Project Settings > API
3. Copy the URL and anon key
4. Add to `apps/app/.env`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### OAuth Configuration for Desktop App

To enable OAuth providers (like Google or GitHub) to work correctly with the Electron desktop application, you must configure the correct redirect URL in your Supabase project settings.

1.  **Navigate to your Supabase Project.**
2.  Go to **Authentication** -> **URL Configuration**.
3.  In the **Redirect URLs** section, ensure the following URL is present:

    ```
    http://localhost:3000/auth/callback
    ```

4.  **Important**: Make sure to **remove** the old `intevia://auth/callback` URL if it exists. Only the `http://localhost:3001` URL should be used for the development environment.
5.  Click **Save**.

This URL points to the web-based callback page that handles the authentication flow and redirects back to the desktop app. It is a required step for the login process to function correctly.

### Gmail (For Feedback System)

1. Create a Gmail account or use an existing one
2. Enable 2-Step Verification
3. Generate an App Password:
   - Go to Google Account > Security > 2-Step Verification > App passwords
4. Add to `apps/web/.env`:
   - `GMAIL_USER`: Your Gmail address
   - `GMAIL_PASS`: The generated app password

## Running the Applications

### Web Application

1. **Start the Next.js development server**

   ```bash
   cd apps/web
   pnpm dev
   ```

   The web application will be available at http://localhost:3000

2. **Start the WebSocket proxy server**

   ```bash
   # In a separate terminal
   cd apps/web
   pnpm proxy
   ```

   The proxy server will be available at ws://localhost:4567

### Desktop Application

```bash
cd apps/app
pnpm dev
```

This will start both the Next.js development server and the Electron application.

### Proxy Server (Standalone)

```bash
cd apps/proxy
pnpm start
```

## Development Workflow

### Running Tests

```bash
# Run all tests across the monorepo
pnpm test

# Run tests for a specific application
cd apps/web
pnpm test
```

### Linting and Formatting

```bash
# Run linting across the monorepo
pnpm lint

# Format code across the monorepo
pnpm format
```

### Building for Production

```bash
# Build all applications
pnpm build

# Build a specific application
cd apps/web
pnpm build
```

## Troubleshooting Common Issues

See [troubleshooting.md](./troubleshooting.md) for solutions to common development issues.

## Next Steps

- Review the [architecture overview](../architecture/overview.md) to understand the system design
- Check out the [CONTRIBUTING.md](../../CONTRIBUTING.md) file for development guidelines
- Explore the codebase to familiarize yourself with the project structure

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://reactjs.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Google Generative AI Documentation](https://ai.google.dev/docs)
