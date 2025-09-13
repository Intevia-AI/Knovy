# Plan: Improve Auto-Update Experience

**Date**: 2025-09-13

**Author**: Gemini Tech Lead Orchestrator

## 1. Goal

The current auto-update mechanism downloads new versions but fails to provide a clear and immediate path for installation. This plan outlines the steps to implement a user-friendly update prompt that allows users to restart and install the update seamlessly.

## 2. Proposed Solution

When an update is downloaded, the application will display a non-intrusive popover window with a clear message and two options:

1.  **Restart Now**: Immediately quits the application, installs the update, and restarts.
2.  **Later**: Closes the notification. The update will be installed on the next manual application restart.

This approach keeps the user in control and informed, aligning with modern UX best practices.

## 3. Technical Implementation

### 3.1. Backend (Electron Main Process)

- **File**: `apps/app/src/main/index.ts`
- **Action**: Modify the `autoUpdater.on('update-downloaded', ...)` listener. Instead of only logging, it will send an IPC message (`updater:update-downloaded`) to the main renderer window.
- **Action**: Add a new IPC handler (`ipcMain.on('updater:quit-and-install', ...)`). This handler will execute `autoUpdater.quitAndInstall()`.

### 3.2. Preload Script

- **File**: `apps/app/src/preload/index.ts`
- **Action**: Whitelist the new IPC channels (`updater:update-downloaded` for receiving, `updater:quit-and-install` for sending) to ensure secure communication between the main and renderer processes.

### 3.3. Frontend (React Renderer)

- **New File**: `apps/app/src/renderer/src/components/UpdateNotification.tsx`
  - **Action**: Create a new React component that will be the UI for the popover. It will contain the notification message and the "Restart Now" and "Later" buttons.
- **File**: `apps/app/src/renderer/src/App.tsx`
  - **Action**: Add a listener for the `updater:update-downloaded` event.
  - **Action**: When the event is received, it will call the existing `popover:create` IPC handler to open a new popover window. The popover's content will be determined by a URL hash (`#update-notification`).
  - **Action**: Implement a simple routing logic based on `window.location.hash` to render the correct component (`UpdateNotification`) when the app is loaded within a popover context.

## 4. Task Breakdown & Agent Assignment

| Task                                   | Agent                                           |
| -------------------------------------- | ----------------------------------------------- |
| 1. Update Main Process Logic           | `@agents/universal/backend-developer`           |
| 2. Update Preload Script               | `@agents/universal/backend-developer`           |
| 3. Implement Update Notification UI    | `@agents/specialized/react-component-architect` |
| 4. Integrate Popover Logic in Renderer | `@agents/specialized/react-nextjs-expert`       |

This structured approach ensures that all parts of the application are correctly modified to support the new feature.
