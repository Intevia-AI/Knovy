# Plan: Improve Login Experience

**Date:** 2025-09-12

## Overview

This plan addresses several user experience issues in the Electron application's login and logout flow. The goal is to make authentication smoother, more intuitive, and visually polished.

## Task Analysis

-   **Project:** Knovy Electron Application
-   **Objective:** Fix UX friction points related to window behavior, UI state, and visual polish during the auth process.
-   **Technology Stack:** Electron, React, TypeScript, CSS/Tailwind.

## Key Issues to Address

1.  **Login Flow Obscurity:** The transparent, always-on-top window during Google OAuth login blocks the browser and confuses the user.
2.  **Duplicate Windows on Logout:** Logging out from the settings modal results in two separate login windows being displayed.
3.  **Unprofessional UI:** Text and logos on the login page are selectable by the user.

## Action Plan & Agent Assignments

The following tasks will be executed sequentially by the `@agents/universal/frontend-developer`.

### Task 1: Locate Key Frontend Components

-   **Description:** Search the `apps/app/src` directory to identify the React components responsible for:
    1.  The main login page.
    2.  The loading/spinner state shown during login.
    3.  The settings modal that contains the logout button.
-   **Agent:** `@agents/universal/frontend-developer`

### Task 2: Fix Login UI Polish

-   **Description:** Modify the appropriate components (found in Task 1) to:
    1.  Add an opaque background during the loading/spinner state.
    2.  Apply CSS (`user-select: none`) to disable text and logo selection on the login page.
-   **Agent:** `@agents/universal/frontend-developer`

### Task 3: Manage "Always on Top" via Auth State

-   **Description:** Find where the application's authentication state is managed in the frontend.
    1.  On **successful login**, make an IPC call to set `alwaysOnTop(true)`.
    2.  On **logout**, make an IPC call to set `alwaysOnTop(false)`.
    3.  On initial app load, ensure `alwaysOnTop` is `false` if the user is not logged in.
-   **Agent:** `@agents/universal/frontend-developer`

### Task 4: Fix Double Window on Logout

-   **Description:** In the settings modal component, modify the logout function to first dispatch an IPC call that closes its own popover window before the logout action proceeds.
-   **Agent:** `@agents/universal/frontend-developer`

## Execution Order

1.  Task 1 (Component Discovery)
2.  Task 2 (UI Polish)
3.  Task 3 (Window Behavior)
4.  Task 4 (Logout Flow)
