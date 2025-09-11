# Plan: Dynamic Summarization Implementation

**Date:** 2025-09-11

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

## Task Breakdown

### Phase 1: Backend and Database

1.  **Update Database Schema:**
    - **File:** `apps/app/src/main/database.ts`
    - **Action:** Add a `summaries` table with `session_id`, `content`, and `updated_at` columns.
    - **Agent:** `@agents/universal/backend-developer`

2.  **Implement Database Services:**
    - **File:** `apps/app/src/main/database-service.ts`
    - **Action:** Create `getSummary(sessionId)`, `saveSummary(...)`, and update `deleteSession` to also remove the corresponding summary.
    - **Agent:** `@agents/universal/backend-developer`

3.  **Expose Services via IPC:**
    - **File:** `apps/app/src/main/index.ts`
    - **Action:** Add `db:get-summary` and `db:save-summary` IPC handlers.
    - **Agent:** `@agents/universal/backend-developer`

4.  **Update Supabase Function:**
    - **File:** `supabase/functions/ai-action-summarize/index.ts`
    - **Action:** Modify the function to accept an optional `previous_summary` and update the prompt to support incremental summarization.
    - **Agent:** `@agents/universal/backend-developer`

### Phase 2: Frontend Logic

5.  **Refactor AI Interaction Hook:**
    - **File:** `apps/app/src/renderer/src/hooks/useAIInteraction.ts`
    - **Action:**
        - Remove the 5-minute context window.
        - Implement the new logic in `sendContextToAI('summary')` to fetch existing summaries and new transcripts, call the updated Supabase function, and save the result.
    - **Agent:** `@agents/universal/frontend-developer`

6.  **Update Chat Panel UI:**
    - **File:** `apps/app/src/renderer/src/components/main/ChatPanel.tsx`
    - **Action:** Modify `handleTabChange` to conditionally trigger summary generation based on whether a summary is already loaded.
    - **Agent:** `@agents/universal/frontend-developer`

7.  **Implement Transcription Loading Optimization:**
    - **File:** `apps/app/src/renderer/src/hooks/useAIInteraction.ts`
    - **Action:** Modify the initial transcript loading to fetch data in batches to improve performance.
    - **Agent:** `@agents/universal/frontend-developer`

### Phase 3: History Viewer Integration

8.  **Add Summary API Endpoint:**
    - **File:** `apps/app/src/main/index.ts`
    - **Action:** In the `historyViewerApp` Express server, add a new route `GET /api/sessions/:id/summary` that fetches and returns the session summary.
    - **Agent:** `@agents/universal/backend-developer`

9.  **Update History Viewer API Client:**
    - **File:** `apps/history-viewer/src/lib/api.ts`
    - **Action:** Add a new function `getSummary(sessionId)` to fetch data from the new endpoint.
    - **Agent:** `@agents/universal/frontend-developer`

10. **Implement Summary View in History:**
    - **File:** `apps/history-viewer/src/app/page.tsx`
    - **Action:**
        - Refactor the session details view to include tabs for "Transcripts" and "Summary".
        - Fetch and display the summary content in the "Summary" tab.
    - **Agent:** `@agents/universal/frontend-developer`

## Execution Strategy

- **Phase 1 (Core Backend):** Execute tasks 1 & 4 in parallel. Then, execute task 2, followed by task 3.
- **Phase 2 (Main App Frontend):** After Phase 1 is complete, execute tasks 5, 6, and 7 sequentially.
- **Phase 3 (History Viewer):** After task 2 is complete, execute task 8. After task 8, execute tasks 9 and 10 sequentially. Phase 3 can run in parallel with Phase 2.
