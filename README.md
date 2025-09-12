# Knovy

Knovy is a powerful AI assistant platform with desktop and web applications for real-time audio analysis, transcription, and AI-powered interactions.

> **Note:** This project is currently undergoing a significant documentation refactor. For the most up-to-date and detailed information, please refer to the main documentation.

## Project Overview

Knovy is a comprehensive platform that combines the power of Google's Generative AI (Gemini) with real-time audio processing to provide intelligent assistance during meetings, presentations, and conversations. The platform consists of three main applications:

1.  **Desktop App (Electron)**: A cross-platform desktop application that captures audio, provides real-time transcription, and offers AI-powered insights. It uses the history viewer to display the transcription and summary of the meetings.
2.  **Web Application (Next.js)**: A browser-based version for demonstrating core features.
3.  **Backend Services (Supabase & Node.js)**: A secure backend for authentication, data persistence, and proxying real-time communication.

## Repository Structure

This is a monorepo managed with pnpm workspaces and Turborepo.

```
/
├── apps/
│   ├── app/                   # Electron + Vite desktop application (current)
│   ├── app_old/               # Deprecated Electron + Next.js desktop application
│   ├── history-viewer/        # Next.js app to show desktop session history
│   ├── web/                   # Next.js marketing and demo website
│   └── proxy/                 # WebSocket proxy server for transcription
├── packages/
│   └── ...                    # Shared packages (UI, TS configs, etc.)
├── supabase/                  # Supabase backend (migrations, functions)
└── docs/                      # Main project documentation
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
    pnpm dlx supabase start
    ```

    You can get the local API keys by running `pnpm dlx supabase status`.

    You can also start the Supabase functions:

    ```bash
    supabase functions serve --env-file .env
    ```

4.  **Set up environment variables**

    Manually copy the `.env.example` file to a new `.env` file in each application directory (`apps/app`, `apps/web`, `apps/proxy`). Then, fill in the required API keys and configuration values, including the Supabase keys from the previous step.

5.  **Start the development servers**

    For the web application demo:

    ```bash
    # Terminal 1: Start the web application
    pnpm --filter web dev

    # Terminal 2: Start the proxy server
    pnpm --filter web proxy
    ```

    For the desktop application:

    ```bash
    # In a separate terminal
    pnpm --filter app dev
    ```

## Documentation

For detailed information on architecture, setup, and development, please see the main project documentation in the `/docs` directory.

## Releasing a New Version

This project uses GitHub Actions to automate the release process for the Electron application. New versions are published to the public [Knovy-Release](https://github.com/Intevia-AI/Knovy-Release) repository.

### Release Workflow

1.  **Update App Version**: Before creating a release, update the `version` number in `apps/app/package.json`. You can do this manually or by using a command like `npm version patch`.

2.  **Tag and Push**: Create a new git tag that matches the pattern `v*.*.*` and push it to the repository. Any Git client, including GUIs like Sublime Merge, can be used.

    ```bash
    # Example using command line
    git tag v0.2.0
    git push origin v0.2.0
    ```

3.  **Automated Release**: Pushing the tag will trigger the `Release` GitHub Action. This workflow builds the macOS application, signs it, and publishes the assets to a new release in the public repository. The application will then be able to automatically update to this new version.

### Code Signing

For the release workflow to produce a signed and notarized macOS application, you must add your code signing credentials as secrets to this private repository. The required secrets are documented in the `.github/workflows/release.yml` file.

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.
