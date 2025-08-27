# Glass Frontend Architecture: Pop-up and Window Management

This document details the frontend architecture of the `@glass` application, focusing on how it achieves its minimal bar-style UI with on-demand pop-up windows for features like settings and transcriptions.

## 1. Core Concept: Multi-Window Architecture

The `@glass` application does not use traditional HTML pop-ups or modals within a single window. Instead, each "pop-up" is a separate, frameless `BrowserWindow` instance managed entirely by the Electron main process.

-   **Main Window (`header`)**: A small, persistent, bar-shaped window that is always visible. It contains the primary controls.
-   **Feature Windows (`listen`, `ask`, `settings`)**: Separate, larger windows that are shown and hidden on demand. They are created as child windows of the `header` but can be moved independently.

This approach provides better performance, isolation, and a more native-feeling experience compared to in-page modals.

## 2. Key Components and Responsibilities

### 2.1. `windowManager.js` (Main Process)

This is the central nervous system for all window-related activities.

-   **Window Pool**: It maintains a `Map` called `windowPool` that holds references to all created `BrowserWindow` instances (e.g., `windowPool.get('header')`).
-   **Creation**: It is responsible for creating all windows, applying common options (frameless, transparent, etc.), and loading their respective HTML content.
-   **Positioning and Layout**: The `WindowLayoutManager` class calculates the correct position and size for each window, typically relative to the main `header` window. It can arrange windows above, below, or to the sides of the main bar.
-   **Visibility Control**: It exposes functions like `showSettingsWindow()` and `hideSettingsWindow()`. These functions do not directly manipulate the window's visibility but instead emit events on an `internalBridge`.

### 2.2. `internalBridge.js` (Main Process)

This is a simple `EventEmitter` instance that acts as an internal event bus for the main process. It decouples the `windowManager` from the services that request UI changes.

-   **Event-Driven Actions**: When a service needs to show a window, it emits an event like `window:requestVisibility`.
-   **Decoupling**: The `windowManager` listens for these events and handles the actual `win.show()` or `win.hide()` calls. This prevents circular dependencies and keeps the logic clean.

### 2.3. `windowBridge.js` (IPC Bridge)

This is the secure bridge between the renderer process (UI) and the main process.

-   **Exposing APIs**: It uses `ipcMain.handle` and `contextBridge.exposeInMainWorld` to securely expose specific functions to the UI, such as `showSettingsWindow`.
-   **UI Trigger**: A UI component, like `MainHeader.js`, calls the exposed API (e.g., `window.api.mainHeader.showSettingsWindow()`).
-   **IPC Handling**: The `windowBridge` receives the IPC call and invokes the corresponding function in `windowManager.js`.

## 3. Communication Flow: Showing a Window

Here is the step-by-step flow when a user hovers over the settings button in the `MainHeader`:

1.  **UI Event**: The `mouseenter` event is triggered on the settings button in `MainHeader.js`.
2.  **IPC Call**: The event handler calls `window.api.mainHeader.showSettingsWindow()`.
3.  **Preload to Main**: The preload script forwards this call to the `ipcMain` listener defined in `windowBridge.js`.
4.  **Bridge to Manager**: The `windowBridge` handler calls the `windowManager.showSettingsWindow()` function.
5.  **Internal Event**: `windowManager.showSettingsWindow()` emits a `window:requestVisibility` event on the `internalBridge`.
6.  **Window Controller**: A listener in `windowManager.js` catches the event.
7.  **Layout Calculation**: It calls the `layoutManager` to calculate the correct `(x, y)` coordinates for the settings window based on the current position of the `header` window.
8.  **Window Action**: It sets the bounds of the settings window and calls `win.show()`.

This event-driven, decoupled architecture allows for flexible and robust control over the application's multiple windows, creating a seamless user experience where feature windows appear and disappear exactly when needed. The new `@apps/app` application can adopt this same pattern using its `popoverManager.ts` as the foundation.
