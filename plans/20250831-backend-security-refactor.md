# Knovy Project Plan

**Objective**: Migrate the Knovy backend from a single, insecure proxy to a secure and scalable hybrid architecture using Supabase and a dual-proxy strategy. This plan is the source of truth for all agent-driven development.

## Agent-Driven Execution

This project is executed by a team of specialized AI agents. Each task in the following phases must be assigned to the appropriate agent to ensure consistency and quality.

- **`@agents/specialized/react-nextjs-expert`**: For all React/Next.js component development.
- **`@agents/universal/backend-developer`**: For all backend tasks, including Supabase schema design, functions, and triggers.
- **`@agents/universal/api-architect`**: For designing new API endpoints or data contracts.
- **`@agents/core/documentation-specialist`**: For all documentation-related tasks.

## Implementation Roadmap

### Phase 1: Critical Security & Backend Refactor

**Goal**: Replace the insecure, monolithic proxy with secure, scalable Supabase Edge Functions for all stateless AI actions.

- **Task 1.1: Design Secure API Contracts for Edge Functions**
  - **Description**: Define detailed request/response contracts for all AI action functions (`summarize`, `recommend-response`, `keyword-search`, `screenshot-analysis`) with JWT authentication requirements.
  - **Agent**: `@agents/universal/api-architect`

- **Task 1.2: Implement AI Actions as Supabase Edge Functions**
  - **Description**: Migrate the business logic for summarization, recommend-response, keyword-search, and screenshot analysis from the old proxy to new Supabase Edge Functions.
  - **Agent**: `@agents/universal/backend-developer`

- **Task 1.3: Build New Secure WebSocket Proxy for Web Demo**
  - **Description**: Create a new, minimal TypeScript-based WebSocket proxy that validates Supabase JWTs on connection. This proxy is for the web demo's real-time transcription only.
  - **Agent**: `@agents/universal/backend-developer`

### Phase 2: Client Integration

**Goal**: Update the client applications to use the new secure backend services.

- **Task 2.1: Update Desktop App to Use Edge Functions**
  - **Description**: Refactor the Electron app's data fetching logic. All AI action requests must be routed to the new Supabase Edge Functions, including the user's JWT in the authorization header.
  - **Agent**: `@agents/specialized/react-nextjs-expert`

- **Task 2.2: Update Web App to Use Secure Proxy**
  - **Description**: Modify the web demo to connect to the new secure WebSocket proxy, passing the Supabase JWT as a query parameter during the connection handshake.
  - **Agent**: `@agents/specialized/react-nextjs-expert`

### Phase 3: Cleanup and Documentation

**Goal**: Finalize the migration by removing old code and updating all documentation.

- **Task 3.1: Remove AI Action Endpoints from Legacy Proxy**
  - **Description**: Once the Edge Functions are fully integrated and tested, remove the corresponding HTTP endpoints (e.g., `/api/ai`) from the legacy proxy server (`apps/proxy`).
  - **Agent**: `@agents/universal/backend-developer`

- **Task 3.2: Update All Architecture Documentation**
  - **Description**: Ensure `README.md`, `docs/architecture/overview.md`, and `docs/setup/development.md` accurately reflect the new, secure architecture.
  - **Agent**: `@agents/core/documentation-specialist`

### Future Phases (Deferred)

- **Task 4.1: Local Transcription Model Implementation (DEFERRED)**
  - **Description**: Replace the cloud-based real-time transcription for the desktop app with a locally-run model like OpenAI's Whisper.
  - **Status**: Deferred until the core Supabase backend is stable.
