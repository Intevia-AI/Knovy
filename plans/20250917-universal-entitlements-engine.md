# Universal Entitlements & Quota Engine: Implementation Plan

- **Date:** 2025-09-17
- **Status:** In Progress
- **Lead Architect:** `@agents/orchestrators/tech-lead-orchestrator`

This document outlines the phased implementation of a centralized Role-Based Access Control (RBAC), entitlements, and usage quota system.

## 1. Core Architectural Principles

1.  **Configuration over Code:** Business rules (roles, quotas, features) are stored in the database, enabling no-code updates.
2.  **Server as Single Source of Truth:** All enforcement is handled by secure Supabase Edge Functions.
3.  **Universal Logging:** Every significant action is logged for analytics and auditing.
4.  **Decoupled & Extensible:** The system is designed for future growth.
5.  **Graceful Error Handling:** Prioritize user-friendly error messages.
6.  **Simplicity:** Avoid unnecessary complexity.
7.  **Documentation:** The plan and related documentation will be kept up-to-date.

## 2. Progress Tracking

| Phase | Task ID | Description | Assigned Agent | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1: Backend Schema** | 1.1 | Create New Supabase Migration | `@agents/universal/backend-developer` | `Done` |
| | 1.2 | Implement `app_settings` Table | `@agents/universal/backend-developer` | `Done` |
| | 1.3 | Implement `quotas` Table | `@agents/universal/backend-developer` | `Done` |
| | 1.4 | Implement `entitlements` Table | `@agents/universal/backend-developer` | `Done` |
| | 1.5 | Verify Logging Tables (`transcription_ledger`, `action_logs`) | `@agents/universal/backend-developer` | `Done` |
| **Phase 2: Central API** | 2.1 | Create `GET /me/session-profile` Edge Function | `@agents/universal/backend-developer` | `Done` |
| | 2.2 | Enhance RBAC Middleware with Quota Checks | `@agents/universal/backend-developer` | `Done` |
| **Phase 3: Client Integration** | 3.1 | Implement Profile-Driven State in `AuthContext` | `@agents/universal/frontend-developer` | `Done` |
| | 3.2 | Implement Dynamic UI Rendering | `@agents/universal/frontend-developer` | `Done` |
| **Phase 4: Admin Dashboard** | 4.1 | Build Admin APIs for Engine Management | `@agents/universal/backend-developer` | `Pending` |
| | 4.2 | Build CRUD UI for Roles & Entitlements | `@agents/universal/frontend-developer` | `Pending` |
| | 4.3 | Build CRUD UI for Quotas | `@agents/universal/frontend-developer` | `Pending` |
| | 4.4 | Build UI for App Settings | `@agents/universal/frontend-developer` | `Pending` |
| **Phase 5: Documentation** | 5.1 | Update Backend & Functions READMEs | `@agents/core/documentation-specialist` | `Pending` |

---

## 3. Phased Implementation Details

### Phase 1: The Unified Backend Schema (The Constitution)

**Goal:** Establish a flexible and scalable database schema.

- **Task 1.1: Create New Supabase Migration**
  - **Action:** Generate a new migration file in `supabase/migrations/` to house all schema changes for this engine.
  - **Agent:** `@agents/universal/backend-developer`

- **Task 1.2: Implement `app_settings` Table**
  - **Action:** In the new migration, create a key-value table `app_settings` (`key TEXT PRIMARY KEY, value JSONB`).
  - **Seed Data:** `('free_tier_experience', '{ "mode": "non-access" }')`.
  - **Agent:** `@agents/universal/backend-developer`

- **Task 1.3: Implement `quotas` Table**
  - **Action:** Create a `quotas` table (`role TEXT, metric TEXT, "limit" NUMERIC, PRIMARY KEY(role, metric)`).
  - **Seed Data:** `('free', 'daily_transcription_minutes', 30)`, `('pro', 'daily_ai_action:summarize_calls', 100)`.
  - **Agent:** `@agents/universal/backend-developer`

- **Task 1.4: Implement `entitlements` Table**
  - **Action:** Create an `entitlements` table (`role TEXT PRIMARY KEY, config JSONB`). This will replace the granular `role_permissions` table for feature flags.
  - **Seed Data:** `('free', '{ "allow_transcription": true, "allow_ai_action:summarize": false }')`, `('pro', '{ "allow_transcription": true, "allow_ai_action:summarize": true, ... }')`.
  - **Agent:** `@agents/universal/backend-developer`

- **Task 1.5: Verify Logging Tables**
  - **Action:** The `action_logs` table already exists. Create the `transcription_ledger` table (`session_id UUID, duration_seconds INT, created_at TIMESTAMPTZ`) to track transcription usage.
  - **Agent:** `@agents/universal/backend-developer`

### Phase 2: The Central Entitlements API (The Brains)

**Goal:** Build the secure server-side logic that serves and enforces the rules.

- **Task 2.1: Create `GET /me/session-profile` Edge Function**
  - **Action:** Create a new Supabase function that returns a single JSON object for the authenticated user, containing:
    1. Relevant `app_settings`.
    2. The user's complete `entitlements` config.
    3. The user's applicable `quotas` along with their current usage (calculated from `action_logs` and `transcription_ledger`).
  - **Agent:** `@agents/universal/backend-developer`

- **Task 2.2: Enhance RBAC Middleware with Quota Checks**
  - **Action:** Refactor the shared `withRBAC` function in `supabase/functions/_shared/rbac.ts`.
    1. Before executing an action, check the `entitlements` config for the user's role.
    2. Perform a quota check against the ledger tables.
    3. Return `403 Forbidden` for entitlement failures and `429 Too Many Requests` for quota violations.
  - **Agent:** `@agents/universal/backend-developer`

### Phase 3: Client-Side Integration (The Experience)

**Goal:** Make the Electron client dynamically render its UI based on the `session-profile`.

- **Task 3.1: Implement Profile-Driven State in `AuthContext`**
  - **Action:** In `apps/app/src/renderer/src/context/AuthContext.tsx`, replace the call to `/me/permissions` with a call to the new `/me/session-profile` endpoint. Store the entire response object in a new context state.
  - **Agent:** `@agents/universal/frontend-developer`

- **Task 3.2: Dynamic UI Rendering**
  - **Action:** Refactor UI components to read from the new session profile context.
    - `App.tsx`: Use `app_settings` to determine if the waitlist or main app should be shown.
    - `ActionsPanel.tsx` (or related component): Use `entitlements` to render AI action buttons.
    - `MainController.tsx`: Use `quotas` to display usage information.
  - **Agent:** `@agents/universal/frontend-developer`

### Phase 4: The Admin Dashboard (Mission Control)

**Goal:** Create a no-code UI for platform management in `apps/admin-dashboard`.

- **Task 4.1: Build Admin APIs for Engine Management**
  - **Action:** Create a new Supabase Edge Function (e.g., `admin-engine-manager`) protected by the `admin` role. This function will provide CRUD operations for the `app_settings`, `quotas`, and `entitlements` tables.
  - **Agent:** `@agents/universal/backend-developer`

- **Task 4.2: Build CRUD UI for Roles & Entitlements**
  - **Action:** In the admin dashboard, create a UI to manage roles and their JSON `config` in the `entitlements` table via the new admin API.
  - **Agent:** `@agents/universal/frontend-developer`

- **Task 4.3: Build CRUD UI for Quotas**
  - **Action:** Create a UI to manage the numeric limits for each role and metric in the `quotas` table.
  - **Agent:** `@agents/universal/frontend-developer`

- **Task 4.4: Build UI for App Settings**
  - **Action:** Create a UI to edit key-value pairs in the `app_settings` table.
  - **Agent:** `@agents/universal/frontend-developer`

### Phase 5: Documentation

**Goal:** Ensure the system is well-documented for future development.

- **Task 5.1: Update Backend & Functions READMEs**
  - **Action:** Update `supabase/README.md` and `supabase/functions/README.md` to reflect the new entitlements engine, session profile API, and testing procedures.
  - **Agent:** `@agents/core/documentation-specialist`