# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Knovy is a **local-first AI desktop assistant** for real-time audio analysis, transcription,
and AI-powered interactions. It runs **fully on the user's machine** — no cloud backend, no
account, no API keys required.

This repository is a **single-package** Electron desktop app at the repo root, using **pnpm**
as the package manager.

## Development Commands

- `pnpm install` — Install dependencies
- `pnpm dev` — Start the desktop app in development (`electron-vite dev`)
- `pnpm build:local` — Build the app locally (unsigned)
- `pnpm build` — Build the signed macOS app (requires code signing setup)
- `pnpm format` — Format code with Prettier
- `pnpm test:run` — Run the config/release tests with Vitest

> Don't run builds or dev servers on your own initiative — only when explicitly asked.

## Architecture

### Technology Stack

- **Desktop**: Electron + Vite + React 19 + TypeScript
- **UI**: Tailwind CSS + Radix UI / shadcn/ui (Electron renderer)
- **Storage**: Local SQLite — all persistence is local
- **Transcription**: bundled **whisper.cpp** binary (local, offline)
- **AI actions**: local **Ollama** (`http://localhost:11434`)
- **Backend**: None. The app is fully local — no cloud services.

### Project Structure

```
/
├── src/                       # Electron app source
│   ├── main/                  # Main process (window mgmt, IPC, SQLite)
│   ├── renderer/              # React UI (renderer process)
│   └── preload/               # Secure IPC bridge
├── resources/                 # Bundled binaries (whisper.cpp, models)
├── code-signing/              # macOS signing / notarization scripts
├── tests/                     # Vitest tests
├── electron.vite.config.ts    # electron-vite build config
├── electron-builder.yml       # Packaging / publish config
└── package.json               # Single root manifest
```

### Key Files

- **Main process**: `src/main/index.ts` — window management, IPC, database
- **Database**: `src/main/database-service.ts` — SQLite (includes `source_type` field for
  distinguishing microphone vs system audio transcriptions)
- **Renderer**: `src/renderer/src/` — React UI components
- **Preload bridge**: `src/preload/index.ts` — secure IPC. IPC channels must be whitelisted
  in the preload's `validChannels` arrays.

### Audio Processing & Transcription

The app implements a **dual-stream audio architecture**:

- **Microphone audio**: processed by `MicAudioProcessor` worklet → tagged `sourceType: "microphone"`
- **System audio**: processed by `SystemAudioProcessor` worklet → tagged `sourceType: "system"`
- Each stream is transcribed by local **whisper.cpp** (via IPC to the main process)
- AI actions (enhancement, chat, summarize, etc.) use local **Ollama**
- Transcriptions are threaded in a chat-like UI (user messages right, others left)

Key files:

- `src/renderer/public/worklets/mic-audio-processor.js`
- `src/renderer/public/worklets/system-audio-processor.js`
- `src/renderer/src/hooks/useAudioAnalysis.ts`
- `src/renderer/src/components/RealTimeAnalysis.tsx`

## Environment Setup

The app requires no cloud credentials. If needed, copy `.env.example` to `.env` — the app
runs without any API keys (Ollama is local HTTP, whisper.cpp is bundled).

## Testing

- Config/release tests run with **Vitest**: `pnpm test:run`. These validate
  `electron-builder.yml` and the GitHub Actions release/staging workflows.
- Do not change code just to pass a test — fix root causes. If a test fails, investigate why.

## Release Process

Releases are automated via **GitHub Actions**:

1. Update the version in `package.json`
2. Create a git tag matching the `v*.*.*` pattern
3. Push the tag to trigger automated build, signing, and release
4. Code signing requires Apple Developer credentials in repository secrets

## Working Guidelines

- **No dependency changes without approval.** Don't add, remove, or upgrade
  `package.json` / lockfile entries unless explicitly asked.
- **Code is the source of truth, not comments.** Comments can be outdated; prioritize the
  code's actual logic when they conflict.
- **Styling** uses Tailwind CSS and follows `shadcn/ui` conventions for UI components.
- **i18n**: user-facing strings live in `lib/translations.ts` (en + zh-TW) — add entries to
  both locales and the type union.
- There are pre-existing TypeScript errors in the codebase (unused params, type issues) —
  don't fix them unless asked.
