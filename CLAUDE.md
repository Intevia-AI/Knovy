# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This repository is a **single-package** Electron desktop app (Knovy) at the repo root,
using **pnpm** as the package manager.

- `pnpm install` - Install dependencies
- `pnpm dev` - Start the desktop app in development (`electron-vite dev`)
- `pnpm build:local` - Build the desktop app locally (unsigned)
- `pnpm build` - Build the signed macOS app (requires code signing setup)
- `pnpm format` - Format code with Prettier
- `pnpm test:run` - Run the config/release tests with Vitest

## Architecture Overview

### Project Structure

A single-package Electron + Vite desktop application rooted at the repository root.

```
/
├── src/                       # Electron app source (main / renderer / preload)
│   ├── main/                  # Main process (window mgmt, IPC, SQLite)
│   ├── renderer/              # React UI (renderer process)
│   └── preload/               # Secure IPC bridge
├── resources/                 # Bundled binaries (whisper.cpp, models)
├── code-signing/              # macOS signing / notarization scripts
├── tests/                     # Vitest tests
├── docs/                      # Architecture documentation
├── electron.vite.config.ts    # electron-vite build config
├── electron-builder.yml       # Packaging / publish config
└── package.json               # Single root manifest
```

### Technology Stack

**Desktop Application:**

- **Electron** + **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS** + **Radix UI** for consistent styling
- **SQLite** for local data storage
- **Electron-vite** for build system

**Backend: None**

- There is NO cloud backend. The app is fully local.
- **SQLite** for all persistent storage
- **whisper.cpp** (bundled binary) for local, offline transcription
- **Ollama** (`http://localhost:11434`) for all AI actions

### Key Architecture Patterns

#### Audio Processing & Transcription

The desktop app implements a **dual-stream audio architecture**:

- **Microphone Audio**: Processed by `MicAudioProcessor` worklet → tagged as `sourceType: "microphone"`
- **System Audio**: Processed by `SystemAudioProcessor` worklet → tagged as `sourceType: "system"`
- Each stream is processed by local **whisper.cpp** (via IPC to the main process)
- AI actions (enhancement, chat, summarize, etc.) use local **Ollama** (`http://localhost:11434`)
- Transcriptions are threaded in chat-like UI (user messages right, others left)

**Key Files:**

- `src/renderer/public/worklets/mic-audio-processor.js`
- `src/renderer/public/worklets/system-audio-processor.js`
- `src/renderer/src/hooks/useAudioAnalysis.ts`
- `src/renderer/src/components/RealTimeAnalysis.tsx`

#### Electron Architecture

- **Main Process**: `src/main/index.ts` - Window management, IPC, database
- **Renderer Process**: `src/renderer/src/` - React UI components
- **Preload Scripts**: `src/preload/index.ts` - Secure IPC bridge
- **Database**: SQLite with `src/main/database-service.ts`

### Environment Setup

The desktop app requires no cloud credentials. If needed, copy `.env.example` to `.env` — the app runs without any API keys (Ollama is local HTTP, whisper.cpp is bundled).

### Development Workflow

1. **Setup**: Install dependencies with `pnpm install`
2. **Ollama** (optional): Install and start Ollama for AI enhancement (`http://localhost:11434`)
3. **Development**: Use `pnpm dev` for the desktop app
4. **Quality**: Run `pnpm format` before commits

### Testing

- **Config/release tests**: `pnpm test:run` (Vitest) — validates `electron-builder.yml` and the GitHub Actions release/staging workflows.

### Release Process

Desktop app releases are automated via **GitHub Actions**:

1. **Update version** in `package.json`
2. **Create git tag** matching `v*.*.*` pattern
3. **Push tag** to trigger automated build, signing, and release
4. **Code signing** requires Apple Developer credentials in repository secrets

### Important Notes

- **Message Threading**: Recent feature enabling speaker identification in transcription UI
- **Database Schema**: Includes `source_type` field for distinguishing microphone vs system audio transcriptions

## Working with Agents

### Agent System Architecture

This project uses an **orchestrator-worker agent system** with specialized agents in `.claude/agents/`.

### Claude Code Orchestrator-Worker Pattern

The Claude Code agent system uses an intelligent orchestrator-worker pattern:

#### Core Components

- **`orchestrator.md`** - Main orchestrator that analyzes tasks and delegates to workers
- **`agent-registry.md`** - Helper that discovers and catalogs available specialized agents
- **`workflow-coordinator.md`** - Manages task dependencies and agent handoffs
- **Specialized Workers** - Domain experts (90+ agents) that handle specific tasks

#### Orchestration Flow

```
User Request → Orchestrator → Agent Registry → Workflow Coordinator → Specialized Workers
```

1. **Task Analysis**: Orchestrator analyzes complexity and requirements
2. **Agent Discovery**: Registry identifies best-suited specialists
3. **Workflow Planning**: Coordinator plans execution sequence and handoffs
4. **Task Execution**: Specialized workers perform their expertise
5. **Quality Gates**: Coordinator ensures deliverable standards
6. **Context Handoffs**: Structured information transfer between agents

#### Usage Protocol

**For Complex Tasks:**

```bash
# Use the orchestrator for multi-step tasks
@orchestrator "Build a real-time chat application with AI features"
```

**For Simple Tasks:**

```bash
# Direct assignment to specialists
@ai-engineer "Implement RAG system for document search"
@python-pro "Optimize this Flask API performance"
```

#### Agent Categories in `.claude/agents/`

- **Architecture & Design**: `architect-review`, `backend-architect`, `code-reviewer`
- **Language Specialists**: `python-pro`, `javascript-pro`, `typescript-pro`, `rust-pro`, etc.
- **Infrastructure & DevOps**: `cloud-architect`, `kubernetes-architect`, `terraform-specialist`
- **Domain Specialists**: `ai-engineer`, `blockchain-developer`, `security-auditor`
- **Performance & Quality**: `performance-engineer`, `database-optimizer`, `code-reviewer`

#### Key Orchestration Rules

1. **Always use the orchestrator** for tasks requiring multiple agents or complex workflows
2. **Maximum 2 agents in parallel** (Claude Code limitation)
3. **Structured context handoffs** between agents with quality gates
4. **Prefer specialists over generalists** (e.g., `ai-engineer` > `backend-developer` for AI tasks)
5. **Quality-first execution** with review cycles and dependency management

## PROJECT-SPECIFIC GUIDELINES

- **Tech Stack**:
  - **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui (Electron renderer)
  - **Backend**: None — fully local (SQLite, whisper.cpp, Ollama)
- **Development Workflow**:
  1.  Consult the **active plan file** (provided by the user, e.g., from the `plans/` directory) for the current project phase and tasks.
  2.  Select the appropriate agent for the task as specified in the plan.
  3.  Follow a Test-Driven Development (TDD) approach where possible. Write tests before implementation.
  4.  For UI components, use `react-component-architect` and adhere to `shadcn/ui` principles if applicable.
  5.  All styling changes must be implemented using `tailwind-css-expert`.
- **Code Interpretation**:
  - Do not blindly trust comments in the code. Comments can become outdated.
  - The code itself is the most reliable source of truth. Prioritize understanding the code's logic and structure over comments when they are in conflict.
- **Testing**:
  - **Unit/Integration Tests**: Jest and React Testing Library.
  - **E2E Tests**: Playwright.
  - Run tests before committing changes.
  - Remember to force stop the in-progress testing after 30 seconds test by adding `timeout 30` before the test command.
  - Do not update the code just to pass the tests.

## High-Level Architecture

The project follows a hierarchical structure as defined in the **active plan file**. Refer to the architecture diagrams there for a visual overview.

## Important Files and Patterns

### Claude Code Agent System

- `.claude/agents/orchestrator.md`: Main orchestrator for task delegation
- `.claude/agents/agent-registry.md`: Agent discovery and capability mapping
- `.claude/agents/workflow-coordinator.md`: Task dependency and handoff management
- `.claude/agents/`: 90+ specialized domain experts for all development tasks

### Development Guidelines

- Use `@orchestrator` for complex multi-step tasks requiring coordination
- Direct specialist assignment for focused single-domain tasks
- All agents support human-in-the-loop for approval of significant changes
- Do not build the app, just focus on the code.
