# Plan: Improve UI/UX of the app

Date: 2025-09-13

## 1. Goal

This plan outlines the tasks to resolve several UI/UX issues in the Knovy desktop application. The goal is to create a more stable and intuitive user experience.

The key issues to address are:
1.  The main control bar's width incorrectly changes when popovers are opened.
2.  The main control bar's position resets unexpectedly, causing popovers to be misplaced.
3.  Popovers lack convenient closing mechanisms (ESC key and a visible close button).

## 2. Task Breakdown & Agent Assignment

### Task 1: Stabilize Main Control Bar Behavior

-   **Task 1.1: Prevent Main Bar from Repositioning**
    -   **Description**: Modify `apps/app/src/renderer/src/App.tsx` to remove the logic that forces the main window to move to the bottom-left corner. The window should respect the position set by the user.
    -   **Agent**: `@agents/specialized/react-nextjs-expert`

-   **Task 1.2: Fix Main Bar Width Fluctuation**
    -   **Description**: Refactor the `useEffect` hook in `apps/app/src/renderer/src/components/main/MainController.tsx` to ensure the main window's width remains `440px` while screen sharing is active, regardless of whether a popover is open.
    -   **Agent**: `@agents/specialized/react-nextjs-expert`

### Task 2: Improve Popover Closing Mechanism

-   **Task 2.1: Discover Popover Components**
    -   **Description**: The agent will search the `apps/app/src/renderer/src/` directory to identify the React component files for the various popovers (e.g., transcriptions, actions, settings).
    -   **Agent**: `@agents/core/code-archaeologist`

-   **Task 2.2: Implement 'Escape' Key to Close Popovers**
    -   **Description**: In each popover component found in Task 2.1, add a `useEffect` hook to listen for the `Escape` key press and trigger the closing of the popover.
    -   **Agent**: `@agents/specialized/react-nextjs-expert`

-   **Task 2.3: Add Visual Close Button to Popovers**
    -   **Description**: In each popover component, add a small, circular close button in the top-right corner that is visible on hover. This provides a clear visual cue for closing the window.
    -   **Agent**: `@agents/universal/frontend-developer`

## 3. Execution Plan

The tasks will be executed in the following order:

1.  **Phase 1 (Parallel Execution)**:
    -   Begin work on **Task 1.1** (Prevent Main Bar from Repositioning).
    -   Begin work on **Task 2.1** (Discover Popover Components).
2.  **Phase 2 (Sequential Execution)**:
    -   Upon completion of Task 1.1, proceed with **Task 1.2** (Fix Main Bar Width).
    -   Upon completion of Task 2.1, proceed with **Task 2.2** (Implement ESC Close) and **Task 2.3** (Add Close Button) in parallel.

This approach allows for independent issues to be addressed simultaneously while respecting dependencies.
