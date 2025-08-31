# Knovy Backend Security Refactor Plan

**Objective**: Refactor the Knovy backend to improve security and efficiency. This plan has two main goals: (1) Migrate the desktop app's stateless AI actions to secure Supabase Edge Functions. (2) Create a separate, rate-limited proxy for the anonymous web demo to protect backend resources.

## Agent-Driven Execution

This project is executed by a team of specialized AI agents. Each task in the following phases must be assigned to the appropriate agent to ensure consistency and quality.

- **`@agents/specialized/react-nextjs-expert`**: For all React/Next.js component development.
- **`@agents/universal/backend-developer`**: For all backend tasks, including Supabase schema design, functions and proxy development.
- **`@agents/universal/api-architect`**: For designing new API endpoints or data contracts.
- **`@agents/core/documentation-specialist`**: For all documentation-related tasks.
- **`@agents/core/code-reviewer`**: For final code quality checks.

## Implementation Roadmap

### Phase 1: Critical Security & Backend Refactor

**Goal**: Replace the insecure, monolithic proxy's AI action handling with secure, scalable Supabase Edge Functions and create an isolated proxy for the public demo.

- **Task 1.1: Design Secure API Contracts for Edge Functions**
  - **Description**: Define detailed request/response contracts for all stateless AI action functions (e.g., `summarization`, `recommend-response`, `keyword-search`, and `screenshot-analysis`) with JWT authentication requirements for the desktop app.
  - **Agent**: `@agents/universal/api-architect`

- **Task 1.2: Implement AI Actions as Supabase Edge Functions**
  - **Description**: Migrate the business logic for all stateless AI actions from the old proxy to new Supabase Edge Functions. **This implementation must use the new Google AI Gemini SDK. Please refer to https://ai.google.dev/gemini-api/docs/quickstart for the new SDK.**
  - **Agent**: `@agents/universal/backend-developer`

- **Task 1.3: Build New Rate-Limited Proxy for Web Demo**
  - **Description**: Create a new, minimal TypeScript-based WebSocket proxy for the public web demo. This proxy must **not** require user authentication but **must** implement strict IP-based rate-limiting (e.g., 20 minutes of transcription per IP per day) to prevent abuse.
  - **Agent**: `@agents/universal/backend-developer`

### Phase 2: Client Integration

**Goal**: Update the client applications to use the new backend services.

- **Task 2.1: Update Desktop App to Use Edge Functions**
  - **Description**: Refactor the Electron app's data fetching logic for AI actions. All non-transcription AI requests must be routed to the new Supabase Edge Functions, including the user's JWT in the authorization header. **This includes updating `apps/app/src/preload/index.ts` to expose any new API-calling functions.**
  - **Agent**: `@agents/specialized/react-nextjs-expert`

- **Task 2.2: Update Web App to Use New Proxy**
  - **Description**: Modify the web demo to connect to the new, rate-limited WebSocket proxy for real-time transcription.
  - **Agent**: `@agents/specialized/react-nextjs-expert`

### Phase 3: Cleanup and Verification

**Goal**: Finalize the migration by removing old code, updating documentation, and verifying code quality.

- **Task 3.1: Remove AI Action Endpoints from Legacy Proxy**
  - **Description**: Once the Edge Functions are fully integrated and tested, remove the corresponding HTTP endpoints (e.g., `/api/ai`) from the legacy proxy server (`apps/proxy`).
  - **Agent**: `@agents/universal/backend-developer`

- **Task 3.2: Final Codebase Linting**
  - **Description**: Run the project-wide linter (`pnpm lint`) to ensure all changes adhere to the established code style and quality standards.
  - **Agent**: `@agents/core/code-reviewer`

- **Task 3.3: Update All Project Documentation**
  - **Description**: Ensure `README.md` and `docs/architecture/overview.md` accurately reflect the new architecture.
  - **Agent**: `@agents/core/documentation-specialist`

### Future Phases (Deferred)

- **Task 4.1: Local Transcription Model Implementation (DEFERRED)**
  - **Description**: Replace the cloud-based real-time transcription for the desktop app with a locally-run model like OpenAI's Whisper.
  - **Status**: Deferred until the core Supabase backend is stable.
