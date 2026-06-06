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

#### Web Application (`apps/web`)

- `pnpm --filter web dev` - Start web app development server
- `pnpm --filter web build` - Build web application
- `pnpm --filter web typecheck` - Run TypeScript type checking

#### History Viewer (`apps/history-viewer`)

- `pnpm --filter history-viewer dev:history` - Start on port 4001
- `pnpm --filter history-viewer build` - Build static Next.js output

### Supabase Development

- `pnpm dlx supabase start` - Start local Supabase services
- `pnpm dlx supabase status` - Get local API keys and service URLs
- `supabase functions serve --env-file .env` - Start Supabase Edge Functions locally

## Architecture Overview

### Project Structure

This is a **monorepo** managed with **pnpm workspaces** and **Turborepo**.

```
/
├── apps/
│   ├── app/                   # Electron + Vite desktop application (main app)
│   ├── app_old/               # Legacy desktop app (deprecated)
│   ├── history-viewer/        # Next.js app embedded in desktop app
│   ├── web/                   # Next.js marketing and demo website
│   └── admin-dashboard/       # Admin management interface
├── packages/
│   ├── ui/                    # Shared React components (Radix + Tailwind)
│   ├── eslint-config/         # Shared ESLint configurations
│   └── typescript-config/     # Shared TypeScript configurations
├── supabase/                  # Backend: Auth, DB, Edge Functions
└── docs/                      # Architecture documentation
```

### Technology Stack

**Desktop Application:**

- **Electron** + **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS** + **Radix UI** for consistent styling
- **SQLite** for local data storage
- **Electron-vite** for build system

**Web Applications:**

- **Next.js 15** + **React 19** + **TypeScript**
- **Tailwind CSS** + shared UI components

**Backend:**

- **Supabase** (PostgreSQL, Auth, Edge Functions)
- **Deno** for serverless Edge Functions
- **Node.js** WebSocket proxy server

### Key Architecture Patterns

#### Audio Processing & Transcription

The desktop app implements a **dual-stream audio architecture**:

- **Microphone Audio**: Processed by `MicAudioProcessor` worklet → tagged as `sourceType: "microphone"`
- **System Audio**: Processed by `SystemAudioProcessor` worklet → tagged as `sourceType: "system"`
- Each stream connects to separate **GeminiClient** instances via **WebSocket**
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

#### Authentication & RBAC

- **Supabase Auth** with OAuth support
- **Role-Based Access Control** with entitlements and quotas
- **Session profiles** fetched via `get-session-profile` Edge Function
- **Admin dashboard** restricted to users with `admin` role

### Environment Setup

Each application requires environment configuration:

1. **Copy `.env.example` to `.env`** in each app directory:
   - `apps/app/.env`
   - `apps/web/.env`

2. **Start Supabase locally**: `pnpm dlx supabase start`

3. **Get Supabase credentials**: `pnpm dlx supabase status`

4. **Fill in required API keys** (Supabase, etc.)

### Development Workflow

1. **Setup**: Install dependencies with `pnpm install`
2. **Supabase**: Start local backend with `pnpm dlx supabase start`
3. **Environment**: Configure `.env` files with API keys
4. **Development**: Use `pnpm dev` or app-specific commands
5. **Quality**: Run `pnpm lint` and `pnpm format` before commits

### Testing

- **Supabase Edge Functions**: Test files in `supabase/functions/*/index.test.ts`
- **Desktop App**: No formal test setup currently
- **Web Apps**: Standard Next.js testing patterns

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
  - **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
  - **Backend**: Supabase (PostgreSQL, Auth, Functions)
- **Development Workflow**:
  1.  Consult the **active plan file** (provided by the user, e.g., from the `plans/` directory) for the current project phase and tasks.
  2.  Select the appropriate agent for the task as specified in the plan.
  3.  Follow a Test-Driven Development (TDD) approach where possible. Write tests before implementation.
  4.  For UI components, use `react-component-architect` and adhere to `shadcn/ui` principles if applicable.
  5.  For backend logic, especially Supabase functions, use `backend-developer`.
  6.  All styling changes must be implemented using `tailwind-css-expert`.
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
