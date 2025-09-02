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

### Phase 1: Migrate Desktop App AI Actions

**Goal**: Migrate the desktop app's stateless AI actions from the existing JS proxy to secure, scalable Supabase Edge Functions. The JS proxy will remain in place to serve the web demo and all real-time transcription.

- **Task 1.1: Design Secure API Contracts for Edge Functions**
  - **Description**: Define detailed request/response contracts for all stateless AI action functions (e.g., `summarization`, `recommend-response`, `keyword-search`, and `screenshot-analysis`) with JWT authentication requirements for the desktop app.
  - **Agent**: `@agents/universal/api-architect`

- **Task 1.2: Implement AI Actions as Supabase Edge Functions**
  - **Description**: Build the business logic for all stateless AI actions as new Supabase Edge Functions, using the latest Google AI Gemini SDK.
  - **Agent**: `@agents/universal/backend-developer`

- **Task 1.3: Write Unit Tests for Edge Functions**
  - **Description**: Create unit tests for the implemented Edge Functions to verify their logic and error handling. This will not include testing the failing `screenshot-analysis` function.
  - **Agent**: `@agents/universal/backend-developer`

- **Task 1.4: Update Desktop App to Use Edge Functions**
  - **Description**: Refactor the Electron app's data fetching logic for AI actions. All non-transcription AI requests must be routed to the new Supabase Edge Functions, including the user's JWT in the authorization header. This includes updating `apps/app/src/preload/index.ts` to expose any new API-calling functions.
  - **Agent**: `@agents/specialized/react-nextjs-expert`

### Phase 2: Verification

**Goal**: Finalize the migration by ensuring code quality and updating documentation.

- **Task 2.1: Final Codebase Linting**
  - **Description**: Run the project-wide linter (`pnpm lint`) to ensure all changes adhere to the established code style and quality standards.
  - **Agent**: `@agents/core/code-reviewer`

- **Task 2.2: Update All Project Documentation**
  - **Description**: Ensure `README.md` and `docs/architecture/overview.md` accurately reflect the new architecture where the desktop app's AI actions are served by Edge Functions.
  - **Agent**: `@agents/core/documentation-specialist`

### Future Phases (Deferred)

- **Task 4.1: Local Transcription Model Implementation (DEFERRED)**
  - **Description**: Replace the cloud-based real-time transcription for the desktop app with a locally-run model like OpenAI's Whisper.
  - **Status**: Deferred until the core Supabase backend is stable.
