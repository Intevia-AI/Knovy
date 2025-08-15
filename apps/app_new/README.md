# Intevia AI Desktop App (electron-vite)

> [!IMPORTANT]
> This document is AI generated. Please verify the information before using it.

A cross-platform Electron desktop application that provides real-time AI-powered screen analysis and interaction capabilities. Built with Electron, Vite, and React, this app offers seamless screen sharing, audio processing, and AI-driven insights for enhanced productivity.

## Overview

The Intevia AI Desktop App is an intelligent screen companion that captures and analyzes your screen content in real-time, providing contextual AI assistance through natural language interactions. The application combines powerful screen capture capabilities with advanced AI processing to deliver actionable insights and automated assistance.

### Key Features

- **Real-time Screen Capture**: Capture and analyze screen content with system-level permissions
- **AI-Powered Analysis**: Leverage Google Gemini AI for intelligent content analysis and responses
- **Audio Processing**: Capture and process both microphone and system audio streams
- **Cross-Platform Support**: Native desktop experience on Windows, macOS, and Linux
- **Secure Authentication**: Integrated Supabase authentication with OAuth support
- **Customizable Interface**: Resizable panels, always-on-top mode, and dark theme support
- **Global Shortcuts**: Quick access via keyboard shortcuts (Cmd/Ctrl+K)
- **Screenshot Tools**: Built-in screenshot capture with area selection

### Technology Stack

- **Electron**: Cross-platform desktop application framework
- **Vite**: Frontend tooling for the user interface
- **React**: Component-based UI library with hooks
- **TypeScript**: Type-safe development
- **Supabase**: Authentication and backend services
- **Google Gemini AI**: Advanced AI processing and natural language understanding
- **WebSocket**: Real-time communication with proxy server

## Prerequisites

Before setting up the development environment, ensure you have:

- **Node.js** (v18 or higher)
- **pnpm** (v8 or higher) - Package manager
- **Git** - Version control
- **Platform-specific requirements**:
  - **macOS**: Xcode Command Line Tools, Screen Recording permissions
  - **Windows**: Windows 10/11, Visual Studio Build Tools (for native modules)
  - **Linux**: Build essentials, X11 development libraries

## Installation & Setup

### 1. Clone and Install Dependencies

```bash
# Navigate to the app directory
cd apps/app_new

# Install dependencies
pnpm install
```

### 2. Environment Configuration

```bash
# Copy the environment template
cp .env.example .env

# Edit the .env file with your configuration
# Required variables:
# - NEXT_PUBLIC_GEMINI_WS_URL: WebSocket URL for Gemini proxy
# - NEXT_PUBLIC_AI_API_URL: API endpoint for AI interactions
# - NEXT_PUBLIC_SUPABASE_URL: Your Supabase project URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anonymous key
```

## Development

### Running in Development Mode

The development setup uses `electron-vite` for a fast and integrated experience with hot-reloading:

```bash
# Start development server
pnpm dev
```

### Development Workflow

1. **UI Development**: Modify files in `src/renderer/src` - changes auto-reload.
2. **Main Process Changes**: Modify `src/main/index.ts` or `src/preload/index.ts` - the app will restart automatically.
3. **Debugging**:
   - Renderer process: Use Chrome DevTools (opens automatically in dev mode).
   - Main process: Use `console.log()` statements in your terminal.

### Development Server & Port Architecture

During development, the application runs in a multi-server environment to provide features like hot-reloading for the frontend components. Understanding how the ports are used is key to working on the system.

| Component                        | Port      | Purpose                                                                                             |
| -------------------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| **History Viewer (Next.js)**     | `3000`    | Serves the history viewer web interface. This is the URL that opens in your browser.                |
| **Backend API Server (Express)** | `4000`    | Provides a REST API for the History Viewer to access the main application's database.               |
| **Main App UI (Vite)**           | `5173`    | Serves the main Electron application's UI. This is what you see in the Electron window itself.      |

#### Workflow

1.  Running `pnpm dev` starts all three servers.
2.  The main application window loads its UI from the Vite server on port `5173`.
3.  When you click the "View History" button, the Electron app opens your default web browser to `http://localhost:3000`.
4.  The History Viewer frontend (running on port `3000`) then makes API calls to the Backend API Server at `http://localhost:4000` to fetch session and transcript data.

> **Note on Production**: In a production build (created with `pnpm build`), this multi-server setup is consolidated. The Backend API Server on port `4000` also serves the pre-built static files of the History Viewer, so only one server is needed.

### Project Structure

```
apps/app_new/
├── src/
│   ├── main/              # Electron Main Process
│   │   └── index.ts
│   ├── preload/           # Preload Script (IPC Bridge)
│   │   └── index.ts
│   └── renderer/          # Vite React UI
│       ├── index.html
│       └── src/
├── resources/             # Static assets for the build
├── electron.vite.config.ts # Electron-Vite Configuration
└── package.json           # Dependencies and scripts
```

## Building & Distribution

```bash
# Build for current platform
pnpm build
```

The build process is configured in `package.json` under the `build` section and uses `electron-builder` to package the application for different platforms.