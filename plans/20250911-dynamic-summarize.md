# Plan: Dynamic Summarization Implementation

**Date:** 2025-09-11
**Status:** In Progress

## Architect's Review & Assessment

**Initial Review:** This plan outlines a strategic evolution of our summarization feature. By moving from ephemeral, time-boxed summaries to a persistent, session-based model, we significantly enhance the user experience and data value. The incremental update approach is efficient, reducing redundant AI processing and providing users with a continuously refined session overview.

**Current Assessment (As of 2025-09-12):** A detailed codebase analysis reveals that the foundational backend and database work (Phase 1), along with the core incremental summarization logic in the Supabase function and frontend hook (Tasks 4, 5), are **already implemented**. The current implementation correctly uses the database to store summaries and fetches new transcripts to create incremental updates.

The remaining work is to refine the user experience, optimize performance for large data sets, and integrate the summaries into the `history-viewer` application.

## Goal

Refactor the summarization feature to be more dynamic, efficient, and persistent. This involves moving away from a fixed-time-window summary to an incremental, session-based summary stored in the local database and displaying it in the history viewer.

## Detailed Task Breakdown

### Phase 1: Backend and Database (Core Logic)

1.  **Update Database Schema:**
    - **File:** `apps/app/src/main/database.ts`
    - **Action:** Add a `summaries` table.
    - **Status:** ✅ **Completed**

2.  **Implement Database Services:**
    - **File:** `apps/app/src/main/database-service.ts`
    - **Action:** Create `getSummary`, `saveSummary`, and update `deleteSession`.
    - **Status:** ✅ **Completed**

3.  **Expose Services via IPC:**
    - **Files:** `apps/app/src/main/index.ts`, `apps/app/src/preload/index.ts`
    - **Action:** Add and expose `db:get-summary` and `db:save-summary` IPC handlers.
    - **Status:** ✅ **Completed**

4.  **Update Supabase Function for Incremental Summaries:**
    - **File:** `supabase/functions/ai-action-summarize/index.ts`
    - **Action:** Modify the function to accept and process an optional `previous_summary`.
    - **Status:** ✅ **Completed**

### Phase 2: Frontend Logic (Main Application)

5.  **Refactor AI Interaction Hook:**
    - **File:** `apps/app/src/renderer/src/hooks/useAIInteraction.ts`
    - **Action:** Implement the new incremental summary logic within `sendContextToAI`.
    - **Status:** ✅ **Completed**

6.  **Update Chat Panel UI/UX:**
    - **File:** `apps/app/src/renderer/src/components/main/ChatPanel.tsx`
    - **Action:** Trigger summary logic from the UI and handle loading states.
    - **Status:** ✅ **Completed**
    - **Note:** Implemented a subtle background update indicator to improve user feedback during periodic summary refreshes.

7.  **Performance Tune: Transcription Loading:**
    - **File:** `apps/app/src/renderer/src/hooks/useAIInteraction.ts`
    - **Action:** Refactor initial transcript loading to handle large datasets efficiently.
    - **Status:** ✅ **Completed**
    - **Note:** Implemented a "Load More" button to paginate through transcripts, preventing initial load performance issues.

### Phase 3: History Viewer Integration

8.  **Create History Summary API Endpoint:**
    - **File:** `apps/app/src/main/index.ts`
    - **Action:** Add a `GET /api/sessions/:id/summary` route to the `historyViewerApp`.
    - **Status:** ✅ **Completed**

9.  **Update History Viewer API Client:**
    - **File:** `apps/history-viewer/src/lib/api.ts` (or equivalent)
    - **Action:** Add a `getSummary(sessionId)` function to fetch from the new endpoint.
    - **Status:** ✅ **Completed**

10. **Implement Summary View in History UI:**
    - **File:** `apps/history-viewer/src/app/page.tsx` (or equivalent)
    - **Action:** Refactor the session detail view into a tabbed interface ("Transcripts" and "Summary") and display the fetched summary.
    - **Status:** ✅ **Completed**

## Execution Strategy (Revised)

With the backend complete, we can focus on the frontend work.

-   **Priority 1 (Main App):**
    -   **Task A (Perf):** Implement "Load More" for transcriptions (Task 7).
    -   **Task B (UX):** Refine `ChatPanel` loading indicators (Task 6).
-   **Priority 2 (History Viewer):**
    -   **Task C (Integration):** Implement the history viewer UI (Tasks 9 & 10).

**Execution Order:**
- **Parallel**: Task A and Task B can be worked on concurrently.
- **Sequential**: Task C can begin anytime but depends on its own sub-tasks (9 → 10).
