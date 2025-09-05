# Knovy Secure AI Actions Plan

**Date**: 2025-09-05

**Objective**: To complete the migration of the app's AI actions to Supabase by implementing a robust security model. This involves securing the backend Edge Functions with JWT authentication and then building the corresponding user login and authentication flow on the frontend.

## Agent-Driven Execution

This project will be executed by the Gemini CLI agent team, following the orchestration defined by the `@agents/orchestrators/tech-lead-orchestrator`.

- **`@agents/universal/backend-developer`**: For all backend tasks, including Supabase function security and configuration.
- **`@agents/universal/frontend-developer`**: For all frontend authentication logic and UI development.
- **`@agents/specialized/react-nextjs-expert`**: For specialized reviews and refactoring of React hooks and components.

## Implementation Roadmap

### Phase 1: Backend Hardening (Task 4 from initial analysis)

**Goal**: Secure all AI-related Supabase Edge Functions to prevent unauthorized access.

- **Task 1.1: Implement JWT Authentication**
  - **Description**: Modify all AI action Edge Functions (`ai-action-*`) to validate the JWT token present in the `Authorization` header of incoming requests. Requests without a valid token must be rejected.
  - **Agent**: `@agents/universal/backend-developer`

- **Task 1.2: Strengthen CORS Policies**
  - **Description**: Update the CORS configuration for all Edge Functions to restrict access to the production application's domain, instead of the permissive `*`.
  - **Agent**: `@agents/universal/backend-developer`

### Phase 2: Frontend Authentication (Task 5 from initial analysis)

**Goal**: Implement a seamless user login flow and integrate authentication into the app's API requests.

- **Task 2.1: Implement Google OAuth Login UI**
  - **Description**: Create a simple, clean login page that contains a single "Sign in with Google" button, leveraging Supabase Auth. On app startup, the application will check the user's authentication state and direct them to the appropriate view (login or main app).
  - **Agent**: `@agents/universal/frontend-developer`

- **Task 2.2: Integrate JWT into API Calls**
  - **Description**: Refactor the `useAIInteraction.ts` hook to retrieve the authenticated user's JWT from the Supabase session. This token will be included in the `Authorization` header of every `supabase.functions.invoke` call.
  - **Agent**: `@agents/specialized/react-nextjs-expert`

### Phase 3: Verification

**Goal**: Ensure the entire flow is working correctly and securely.

- **Task 3.1: End-to-End Testing**
  - **Description**: Perform a full test of the login flow and AI action execution to confirm that authenticated users can successfully use the features and unauthenticated requests are blocked.
  - **Agent**: `@agents/core/code-reviewer`
