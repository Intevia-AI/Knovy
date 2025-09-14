# Plan: Refactor Electron APIs

**Date**: 2025-09-14

## 1. Goal

This plan outlines the process of refactoring the Knovy desktop application's Electron APIs to improve scalability, maintainability, and ease of use. The primary objectives are to consolidate duplicate APIs and remove unused code.

## 2. Background

The current Electron API has several issues:
- **Duplicate APIs**: Specific APIs exist for showing and hiding each type of popover window (e.g., `app:show-transcriptions`, `app:hide-transcriptions`). A single, generic API would be more scalable. Similarly, window positioning is handled by multiple specific APIs.
- **Unused Code**: The codebase contains APIs and files that may no longer be in use, creating unnecessary clutter and potential for confusion.

This refactoring will simplify the Inter-Process Communication (IPC) layer, making the application easier to develop and maintain.

## 3. Task Breakdown

### Phase 1: Analysis

1.  **Code Archaeology**:
    - **Agent**: `@agents/core/code-archaeologist`
    - **Task**: Thoroughly scan the `apps/app` codebase to identify all usages of the following APIs:
        - Popover APIs: `app:show-*`, `app:hide-*`
        - Window positioning APIs: `window:center`, `window:move-to-bottom-left`
        - Potentially unused APIs: `popover:sendMessage`, `electronAPI:requestSources`, `ai:loading-state-change`
    - **Task**: Identify which files import or reference potentially unused components like `RealTimeSubtitle.tsx`.
    - **Output**: A detailed report mapping each API and file to its location in the codebase.

### Phase 2: Refactoring & Cleanup

2.  **Refactor Main Process APIs**:
    - **Agent**: `@agents/universal/backend-developer`
    - **Task**: Based on the archaeology report, refactor the main process files (`src/main/index.ts`, `src/main/popoverManager.ts`) and the preload script (`src/preload/index.ts`).
        - Consolidate popover show/hide APIs into a single `app:toggle-panel` IPC channel that accepts a `panelId`.
        - Consolidate window positioning APIs (`window:center`, `window:move-to-bottom-left`) into a single `window:set-position` channel.
        - Remove the handlers for the old, deprecated APIs.
        - Remove the definitions for confirmed unused APIs (`popover:sendMessage`, etc.) from the preload script and main process.

3.  **Update Renderer Implementation**:
    - **Agent**: `@agents/universal/frontend-developer`
    - **Task**: Update the renderer-side code (`apps/app/src/renderer`) to use the new, consolidated APIs.
        - Modify components like `MainController.tsx` and others to call the new `app:toggle-panel` and `window:set-position` APIs if they were using the old ones.
        - Ensure the application's UI logic correctly interacts with the refactored IPC channels.

4.  **Remove Unused Files**:
    - **Agent**: `@agents/universal/frontend-developer`
    - **Task**: Based on the archaeology report and confirmation, delete unused files such as `RealTimeSubtitle.tsx` from the project.

### Phase 3: Verification

5.  **Code Review**:
    - **Agent**: `@agents/core/code-reviewer`
    - **Task**: Conduct a final review of all code changes to ensure they meet quality standards, follow project conventions, and have been implemented correctly.
    - **Task**: Verify that the application builds and runs without errors after the refactoring.

## 4. Execution Plan

The execution will proceed in the following order:

1.  **Sequential**: Complete the **Code Archaeology** task first to provide a clear map for the refactoring work.
2.  **Sequential**: Once the analysis is complete, the **Refactor Main Process APIs** task will be executed.
3.  **Sequential**: Following the backend refactoring, the **Update Renderer Implementation** task will begin.
4.  **Parallel**: The **Remove Unused Files** task can be performed concurrently with tasks 2 and 3.
5.  **Final Step**: The **Code Review** will be the final step, reviewing all merged changes.
