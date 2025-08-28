# Intevia AI Desktop App

> [!IMPORTANT]
> This document is AI generated. Please verify the information before using it.

A cross-platform Electron desktop application that provides real-time AI-powered screen analysis and interaction capabilities. Built with Electron, Next.js, and React, this app offers seamless screen sharing, audio processing, and AI-driven insights for enhanced productivity.

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
- **Next.js**: React framework for the user interface (static export)
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
cd apps/app

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

### 3. Platform-Specific Setup

#### macOS

```bash
# Grant screen recording permissions
# System Settings > Privacy & Security > Screen Recording > Enable for Terminal/IDE
```

#### Windows

```bash
# Install Visual Studio Build Tools (if not already installed)
# Required for native Electron modules
```

#### Linux

```bash
# Install required system libraries
sudo apt-get install libnss3-dev libatk-bridge2.0-dev libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2-dev
```

## Development

### Running in Development Mode

The development setup runs both Next.js and Electron concurrently with hot-reloading:

```bash
# Start development server (runs both Next.js and Electron)
pnpm dev

# This command:
# 1. Starts Next.js dev server on http://localhost:3000
# 2. Launches Electron app that loads from the dev server
# 3. Enables hot-reloading for UI changes
```

### Development Workflow

1. **UI Development**: Modify files in `app/`, `components/`, `hooks/` - changes auto-reload
2. **Main Process Changes**: Modify `electron/main.mjs` or `electron/preload.mjs` - requires Electron restart
3. **Debugging**:
   - Renderer process: Use Chrome DevTools (opens automatically in dev mode)
   - Main process: Use `console.log()` statements or attach Node.js debugger

### Project Structure

```
apps/app/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main application page
│   ├── layout.tsx         # Root layout component
│   └── selection/         # Screenshot selection page
├── components/            # React components
│   ├── main.tsx          # Main application component
│   ├── main/             # Main UI components
│   └── logos/            # Logo components
├── electron/             # Electron main process
│   ├── main.mjs         # Main process entry point
│   └── preload.mjs      # Preload script (IPC bridge)
├── hooks/               # Custom React hooks
├── context/             # React context providers
├── lib/                 # Utility libraries
├── types/               # TypeScript type definitions
├── public/              # Static assets
└── package.json         # Dependencies and scripts
```

### Detailed Architecture & Orchestration

The application is organized in **three layers** that communicate via Electron's IPC mechanism:

```
┌──────────────────────────────┐
│  Electron Main Process       │
│  (electron/main.mjs)         │
└──────────────┬───────────────┘
               │  IPC (ipcMain)
┌──────────────▼───────────────┐
│  Preload Bridge              │
│  (electron/preload.mjs)      │
└──────────────┬───────────────┘
               │  window.electronAPI
┌──────────────▼───────────────┐
│  Next.js Renderer (React UI) │
│  (app/ + components/)        │
└──────────────────────────────┘
```

1. **Electron Main Process** (`electron/main.mjs`)
   - Creates the application window, registers global shortcuts, manages permissions, and handles heavy-weight native tasks (screenshot capture, settings persistence, OAuth callbacks).
   - Exposes functionality to the renderer via `ipcMain` listeners (e.g.
     `electronAPI:minimizeWindow`, `electronAPI:selectSource`).

2. **Preload Script** (`electron/preload.mjs`)
   - Runs in an isolated context and exposes a whitelisted API (`window.electronAPI`) to the React app using `contextBridge`.
   - Forwards calls to the main process using `ipcRenderer` and streams events back to the UI.

3. **Next.js Renderer** (everything under `app/`, `components/`, `hooks/`)
   - Renders the UI, controls screen sharing, audio visualisers, and AI chat.
   - Talks to the main process only through `window.electronAPI` and to the AI backend through the Next.js API route `/api/ai`.

#### Startup Flow

```text
pnpm dev            # runs `next dev` + `electron .`
      │
      ├─▶ Next.js dev server starts on :3000 ➜ compiles React pages
      └─▶ Electron launches BrowserWindow ➜ loads http://localhost:3000
            │
            └─▶ app/layout.tsx → app/page.tsx → <Main />
```

#### Key Files at a Glance

| Area         | File                        | Role                                                       |
| ------------ | --------------------------- | ---------------------------------------------------------- |
| Main Process | `electron/main.mjs`         | Window management, global shortcuts, OAuth, screen capture |
| Bridge       | `electron/preload.mjs`      | Secure API exposure (`window.electronAPI`)                 |
| UI Shell     | `app/layout.tsx`            | Global providers, theming                                  |
| Home Page    | `app/page.tsx`              | Entrypoint that renders `<Main />`                         |
| Core UI      | `components/main.tsx`       | Orchestrates screen share, audio, AI chat                  |
| Hooks        | `hooks/useElectron.ts`      | Electron window & capture controls                         |
| Hooks        | `hooks/useAIInteraction.ts` | Chat state & `/api/ai` calls                               |
| API          | `app/api/ai/route.ts`       | Serverless function → Google Gemini                        |
| Validation   | `lib/validateEnv.ts`        | Checks `.env` variables on startup                         |

#### Data Flow Example (Screenshot ➜ AI)

1. User clicks **Screenshot** in UI (`<ControlPanel />`).
2. `useElectron` calls `window.electronAPI.startScreenshot()`.
3. Main process shows transparent overlay, captures the selected area, saves PNG, then emits `electronAPI:screenshotTaken` with the file path.
4. `useAIInteraction` reads the PNG, posts `{ messages, data: { screenshot } }` to `/api/ai`.
5. API route forwards to Google Gemini, returns AI response → chat panel updates.

This section should give new contributors a quick mental model of how all parts fit together.

### Key Development Files

- **`electron/main.mjs`**: Main Electron process, handles window management, IPC, system integration
- **`electron/preload.mjs`**: Secure bridge between main and renderer processes
- **`components/main.tsx`**: Primary UI component with screen sharing and AI interaction
- **`hooks/useElectron.ts`**: React hook for Electron API interactions
- **`hooks/useScreenShare.ts`**: Screen capture and recording functionality
- **`hooks/useAIInteraction.ts`**: AI processing and chat management

## Building & Distribution

### Development Build

```bash
# Build Next.js app for production
pnpm build

# This creates a static export in the 'out' directory
```

### Platform-Specific Builds

```bash
# Build for current platform
pnpm build

# The electron-builder configuration in package.json handles:
# - macOS: .dmg and .zip packages
# - Windows: .exe installer and portable version
# - Linux: .AppImage and .deb packages
```

### Build Configuration

The build process is configured in `package.json` under the `build` section:

- **App ID**: `app.intevia.ai`
- **Product Name**: `Intevia AI`
- **Output Directory**: `dist/`
- **Supported Platforms**: macOS, Windows, Linux

### Code Signing & Notarization

For distribution, you'll need to configure code signing:

#### macOS

```bash
# Set up Apple Developer certificates
# Configure in package.json build.mac section
# Requires: Developer ID Application certificate
```

#### Windows

```bash
# Set up code signing certificate
# Configure in package.json build.win section
# Requires: Valid code signing certificate
```

## Testing

### Manual Testing

```bash
# Run in development mode
pnpm dev

# Test key features:
# 1. Screen capture permissions
# 2. Audio recording functionality
# 3. AI interaction and responses
# 4. Authentication flow
# 5. Screenshot capture
# 6. Global shortcuts (Cmd/Ctrl+K)
```

### Automated Testing

```bash
# Run type checking
pnpm type-check

# Run linting
pnpm lint

# Note: Add unit tests for components and hooks as needed
```

## Deployment

### Local Distribution

```bash
# Build for distribution
pnpm build

# Distribute files from dist/ directory
# - macOS: .dmg file for easy installation
# - Windows: .exe installer or portable version
# - Linux: .AppImage for universal compatibility
```

### Auto-Updates (Optional)

To implement auto-updates, consider integrating:

- **electron-updater**: For automatic update checking and installation
- **GitHub Releases**: For hosting update packages
- **Update server**: Custom update distribution

## Troubleshooting

### Common Issues

#### Screen Recording Permission Denied (macOS)

```bash
# Solution: Grant permission manually
# System Settings > Privacy & Security > Screen Recording
# Enable permission for your terminal or IDE
```

#### Electron App Won't Start

```bash
# Check Node.js version
node --version  # Should be v18+

# Clear node_modules and reinstall
rm -rf node_modules
pnpm install
```

#### Build Failures

```bash
# Clear build cache
rm -rf .next out dist

# Rebuild
pnpm build
```

#### WebSocket Connection Issues

```bash
# Verify proxy server is running
# Check NEXT_PUBLIC_GEMINI_WS_URL in .env
# Ensure firewall allows WebSocket connections
```

### Debug Mode

```bash
# Enable Electron debug logging
DEBUG=electron* pnpm dev

# Enable verbose logging
ELECTRON_ENABLE_LOGGING=1 pnpm dev
```

### Performance Optimization

- **Memory Usage**: Monitor with Chrome DevTools Memory tab
- **CPU Usage**: Use Activity Monitor (macOS) or Task Manager (Windows)
- **Bundle Size**: Analyze with `next-bundle-analyzer`

## Contributing

When contributing to the Electron app:

1. **Follow TypeScript best practices**
2. **Add JSDoc comments for new functions**
3. **Test on multiple platforms when possible**
4. **Update this README for new features**
5. **Ensure proper error handling in IPC communications**

## Security Considerations

- **Context Isolation**: Enabled by default in `webPreferences`
- **Node Integration**: Disabled in renderer process
- **Preload Script**: Use for secure IPC communication
- **Content Security Policy**: Configure for production builds
- **Screen Capture**: Requires explicit user permissions

## Related Documentation

- [Main Project README](../../README.md)
- [Web Application](../web/README.md)
- [Proxy Server](../proxy/README.md)
- [Development Setup Guide](../../docs/setup/development.md)
- [Architecture Overview](../../docs/architecture/overview.md)
