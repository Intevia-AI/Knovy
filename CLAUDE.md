# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Monorepo Management

- `pnpm install` - Install all dependencies
- `pnpm dev` - Start all development servers using Turbo
- `pnpm build` - Build all applications using Turbo
- `pnpm lint` - Run linting across all packages using Turbo
- `pnpm format` - Format code with Prettier

### Application-Specific Commands

#### Desktop App (`apps/app`)

- `pnpm --filter app dev` - Start desktop app development (includes history-viewer)
- `pnpm --filter app build:local` - Build desktop app locally (unsigned)
- `pnpm --filter app build` - Build signed macOS app (requires code signing setup)

#### History Viewer (`apps/history-viewer`)

- `pnpm --filter history-viewer dev:history` - Start on port 4001
- `pnpm --filter history-viewer build` - Build static Next.js output

## Architecture Overview

### Project Structure

This is a **monorepo** managed with **pnpm workspaces** and **Turborepo**.

```
/
├── apps/
│   ├── app/                   # Electron + Vite desktop application (main app)
│   └── history-viewer/        # Next.js app embedded in desktop app
├── packages/
│   ├── ui/                    # Shared React components (Radix + Tailwind)
│   ├── eslint-config/         # Shared ESLint configurations
│   └── typescript-config/     # Shared TypeScript configurations
└── docs/                      # Architecture documentation
```

### Technology Stack

**Desktop Application:**

- **Electron** + **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS** + **Radix UI** for consistent styling
- **SQLite** for local data storage
- **Electron-vite** for build system

**History Viewer:**

- **Next.js 15** + **React 19** + **TypeScript**
- Built as a static export and embedded inside the desktop app

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

- `apps/app/src/renderer/public/worklets/mic-audio-processor.js`
- `apps/app/src/renderer/public/worklets/system-audio-processor.js`
- `apps/app/src/renderer/src/hooks/useAudioAnalysis.ts`
- `apps/app/src/renderer/src/components/RealTimeAnalysis.tsx`

#### Electron Architecture

- **Main Process**: `apps/app/src/main/index.ts` - Window management, IPC, database
- **Renderer Process**: `apps/app/src/renderer/src/` - React UI components
- **Preload Scripts**: `apps/app/src/preload/index.ts` - Secure IPC bridge
- **Database**: SQLite with `apps/app/src/main/database-service.ts`

### Environment Setup

The desktop app requires no cloud credentials. If needed, copy `apps/app/.env.example` to `apps/app/.env` — the app runs without any API keys (Ollama is local HTTP, whisper.cpp is bundled).

### Development Workflow

1. **Setup**: Install dependencies with `pnpm install`
2. **Ollama** (optional): Install and start Ollama for AI enhancement (`http://localhost:11434`)
3. **Development**: Use `pnpm dev` or `pnpm --filter app dev` for the desktop app
4. **Quality**: Run `pnpm lint` and `pnpm format` before commits

### Testing

- **Desktop App**: No formal test setup currently

### Release Process

Desktop app releases are automated via **GitHub Actions**:

1. **Update version** in `apps/app/package.json`
2. **Create git tag** matching `v*.*.*` pattern
3. **Push tag** to trigger automated build, signing, and release
4. **Code signing** requires Apple Developer credentials in repository secrets

### Important Notes

- **Message Threading**: Recent feature enabling speaker identification in transcription UI
- **History Viewer**: Embedded Next.js app showing session history, built separately and copied into desktop app
- **Shared Packages**: UI components and configs are shared across applications via workspace dependencies
- **Local Development**: Desktop app runs history-viewer concurrently during development
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
