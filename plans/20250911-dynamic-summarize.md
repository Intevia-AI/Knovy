# Plan: Dynamic Summarization Implementation

**Date:** 2025-09-11

## Architect's Review

This plan outlines a strategic evolution of our summarization feature. By moving from ephemeral, time-boxed summaries to a persistent, session-based model, we significantly enhance the user experience and data value. The incremental update approach is efficient, reducing redundant AI processing and providing users with a continuously refined session overview. This architecture not only improves performance but also lays the groundwork for more advanced session-based analytics in the future.

The breakdown below provides a detailed roadmap for implementation. Let's execute this with precision.

## Goal

Refactor the summarization feature to be more dynamic, efficient, and persistent. This involves moving away from a fixed-time-window summary to an incremental, session-based summary stored in the local database and displaying it in the history viewer.

## Key Requirements

1.  **Database Persistence:**
    - Create a new `summaries` table in the local SQLite database to store session summaries.
    - The table should store the summary content and the timestamp of the last update.

2.  **Incremental Summarization Logic:**
    - When a summary is requested:
        - If no summary exists for the current session, summarize all available transcriptions.
        - If a summary exists, fetch it and all transcriptions created since the summary's timestamp.
        - Send the existing summary and new transcriptions to an updated AI function to generate a new, combined summary.
    - The Supabase `ai-action-summarize` function must be updated to handle this incremental logic.

3.  **Efficient UI Interaction:**
    - The "Summary" tab in the `ChatPanel` should only trigger a new summary generation if one doesn't already exist or if new transcriptions are available.
    - Avoid re-summarizing the same content repeatedly.

4.  **Performance Optimization:**
    - Improve the performance of the `ChatPanel` by implementing batch loading or virtualization for the transcription list, which can grow very large.

5.  **History Viewer Integration:**
    - The `history-viewer` app must be updated to display the saved summary for each session in a tabbed view.

## Architectural Note: IPC API Updates

**IMPORTANT:** Any new IPC channels exposed from the main process must be explicitly added to the `api` object and the channel allow-lists in `apps/app/src/preload/index.ts`. This is a critical security and functionality step to make the API available to the renderer process.

## Detailed Task Breakdown

### Phase 1: Backend and Database (Core Logic)

1.  **Update Database Schema:**
    - **File:** `apps/app/src/main/database.ts`
    - **Action:** Add a `summaries` table. Schema should include: `id (PK)`, `session_id (FK, indexed)`, `content (TEXT)`, `updated_at (DATETIME)`.
    - **Agent:** `@agents/universal/backend-developer`

2.  **Implement Database Services:**
    - **File:** `apps/app/src/main/database-service.ts`
    - **Action:**
        - Create `getSummary(sessionId)` to retrieve the latest summary for a session.
        - Create `saveSummary({ sessionId, content })` to insert or update a summary, setting `updated_at`.
        - Update `deleteSession(sessionId)` to cascade the delete to the `summaries` table.
    - **Agent:** `@agents/universal/backend-developer`

3.  **Expose Services via IPC:**
    - **File 1:** `apps/app/src/main/index.ts`
        - **Action:** Add `ipcMain.handle('db:get-summary', ...)` and `ipcMain.handle('db:save-summary', ...)` handlers that call the new database services.
    - **File 2:** `apps/app/src/preload/index.ts`
        - **Action:** Expose the new IPC channels. Add `db:get-summary` and `db:save-summary` to the `invoke` allow-list and add corresponding methods to the `api` object.
    - **Agent:** `@agents/universal/backend-developer`

4.  **Update Supabase Function for Incremental Summaries:**
    - **File:** `supabase/functions/ai-action-summarize/index.ts`
    - **Action:**
        - Modify the function to accept an optional `previous_summary` in the payload.
        - Update the prompt logic:
            - If `previous_summary` is provided, use a prompt like: "You are given a previous summary and new conversation transcripts. Integrate the new transcripts into the summary, refining and extending it. Previous Summary: {summary}. New Transcripts: {transcripts}."
            - If not, use the existing summarization prompt.
    - **Agent:** `@agents/universal/backend-developer`

### Phase 2: Frontend Logic (Main Application)

5.  **Refactor AI Interaction Hook:**
    - **File:** `apps/app/src/renderer/src/hooks/useAIInteraction.ts`
    - **Action:**
        - In `sendContextToAI`, for the 'summary' type, implement the new incremental logic:
            1.  Call `window.electronAPI.getSummary(sessionId)`.
            2.  Fetch transcripts created since the summary's `updated_at` timestamp.
            3.  If new transcripts exist, call the `ai-action-summarize` function with `previous_summary` and new transcripts.
            4.  On receiving the new summary, save it via `window.electronAPI.saveSummary(...)`.
            5.  Update the component's state with the new summary.
        - Remove the old 5-minute context window logic.
    - **Agent:** `@agents/universal/frontend-developer`

6.  **Update Chat Panel UI/UX:**
    - **File:** `apps/app/src/renderer/src/components/main/ChatPanel.tsx`
    - **Action:**
        - In `handleTabChange`, trigger the summary logic from `useAIInteraction`.
        - **UX Improvement:** Display a loading indicator in the "Summary" tab content area while a summary is being generated. If a summary already exists, display it immediately and show a subtle "updating..." indicator if a new one is being fetched.
    - **Agent:** `@agents/specialized/react-component-architect`

7.  **Performance Tune: Transcription Loading:**
    - **File:** `apps/app/src/renderer/src/hooks/useAIInteraction.ts`
    - **Action:** Refactor the initial transcript loading (`getTranscripts`) to use pagination or virtualization if the list is long. This is a parallel enhancement to ensure the UI remains responsive.
    - **Agent:** `@agents/universal/frontend-developer`

### Phase 3: History Viewer Integration

8.  **Create History Summary API Endpoint:**
    - **File:** `apps/app/src/main/index.ts`
    - **Action:** Inside the `historyViewerApp` Express setup, add a new route: `GET /api/sessions/:id/summary`. This route should call the `databaseService.getSummary(id)` method and return the result.
    - **Agent:** `@agents/universal/backend-developer`

9.  **Update History Viewer API Client:**
    - **File:** `apps/history-viewer/src/lib/api.ts`
    - **Action:** Add a `getSummary(sessionId)` function that fetches data from the `/api/sessions/:id/summary` endpoint.
    - **Agent:** `@agents/universal/frontend-developer`

10. **Implement Summary View in History UI:**
    - **File:** `apps/history-viewer/src/app/page.tsx`
    - **Action:**
        - Refactor the session detail view into a tabbed interface (`<Tabs>` from shadcn/ui).
        - Create two tabs: "Transcripts" and "Summary".
        - The "Summary" tab should call `getSummary(sessionId)` and display the content. Handle loading and empty states gracefully.
    - **Agent:** `@agents/specialized/react-component-architect`

## Sub-Agent Assignments & Execution Strategy

### Available Agents
- `@agents/universal/backend-developer`: For database, IPC, and Supabase function logic.
- `@agents/universal/frontend-developer`: For core frontend logic and data fetching hooks.
- `@agents/specialized/react-component-architect`: For UI/UX implementation and component structure in React.

### Execution Order

- **Phase 1 (Backend):**
    - **Parallel**: Task 1 (DB Schema) & Task 4 (Supabase Func).
    - **Sequential**: After Task 1 completes, proceed with Task 2 (DB Services).
    - **Sequential**: After Task 2 completes, proceed with Task 3 (IPC).
- **Phase 2 & 3 (Frontend - Can run in parallel):**
    - **Phase 2 Execution**:
        - **Prerequisite**: Phase 1 must be complete.
        - **Sequential**: Task 5 (Hook) → Task 6 (UI/UX).
        - **Parallel**: Task 7 (Perf. Tune) can be worked on anytime after Phase 1.
    - **Phase 3 Execution**:
        - **Prerequisite**: Task 2 (DB Services) must be complete.
        - **Sequential**: Task 8 (API Endpoint) → Task 9 (API Client) → Task 10 (History UI).