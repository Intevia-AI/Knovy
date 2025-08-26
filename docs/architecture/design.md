# Intevia AI App Redesign: Concept and Implementation Plan

This document outlines the redesign of the Intevia AI desktop application, moving from the current layout to a minimal, bar-style interface with a separate transcriptions window, as inspired by `concept.html`.

## 1. Core Concepts

The new design prioritizes a minimal footprint on the user's screen while providing powerful, context-aware features on demand.

-   **Main Bar**: A small, persistent, glassmorphism-style bar that houses the primary controls. It stays on top of other windows but remains unobtrusive.
-   **Separate Transcriptions Window**: Real-time transcriptions are moved from the main UI into a dedicated, separate window. This window is only shown when the user explicitly requests it, reducing screen clutter.
-   **Hover-activated Features**: Secondary features and settings are accessible through hover-activated pop-up menus, keeping the main bar clean and focused.

## 2. Component Breakdown & User Flow

### 2.1. Main Bar (`apps/app/src/renderer/src/components/main.tsx`)

The main bar will be the new primary interface.

-   **Dimensions**: The Electron window will be resized to be short and wide, resembling a bar (e.g., 480px wide by 60px high).
-   **Appearance**: It will use a glassmorphism effect (`vibrancy: 'fullscreen-ui'` on macOS, transparent background on other OS).
-   **Controls**:
    -   **Listen Button**:
        -   **State**: Toggles between "Listen" (inactive) and "Stop" (active/recording).
        -   **Action**: Starts or stops the screen sharing and audio recording session.
        -   **Hover (while listening)**: A small pop-up appears showing a preview of the screen being shared.
    -   **Transcriptions Button**:
        -   **Visibility**: This button is **only visible** when a recording session is active.
        -   **Action**: Clicking this button will open the separate "Transcriptions Window". It does not stop the recording.
    -   **Features Button**:
        -   **Action**: Hovering over this button reveals a pop-up menu.
        -   **Menu Items**: The pop-up will contain text-based buttons for features like "Generate Summary", "View History", and other AI actions. Icons can be added later, but text with tooltips is the priority.
    -   **Settings Button**:
        -   **Action**: Hovering over this button reveals a pop-up menu for application settings.
        -   **Menu Items**: Language selection, custom prompt input, etc.

### 2.2. Transcriptions Window

A new, separate Electron `BrowserWindow` instance.

-   **Creation**: Instantiated from the main process (`index.ts`) when the "Transcriptions" button is clicked.
-   **Position**: It should appear directly above the Main Bar, with a small margin (e.g., 8px) between them.
-   **Content**: This window will render the real-time transcription component (`RealTimeSubtitle.tsx` or a similar new component).
-   **Behavior**: It is a standalone, non-modal window. It can be closed independently of the Main Bar.

## 3. Step-by-Step Implementation Plan

### Step 1: Refactor Electron Main Process (`apps/app/src/main/index.ts`)

1.  **Modify `createWindow` for Main Bar**:
    -   Change the default `width` and `height` of the `mainWindow` to match the new bar design (e.g., `width: 480`, `height: 60`).
    -   Ensure `frame: false` and `transparent: true` are set.
2.  **Create `createTranscriptionWindow` function**:
    -   Define a new function to create a `BrowserWindow` for the transcriptions.
    -   This window will be larger (e.g., `width: 480`, `height: 300`).
    -   It should also be frameless and transparent.
    -   It will load the same `index.html` but potentially with a different route or query parameter to render only the transcription component (e.g., `/transcriptions`).
3.  **Add IPC Handlers**:
    -   Create an IPC handler `ipcMain.on('app:show-transcriptions', ...)` that calls `createTranscriptionWindow`. It should calculate the position of the window based on the main bar's current position.
    -   Create an IPC handler `ipcMain.on('app:hide-transcriptions', ...)` to close the transcriptions window.

### Step 2: Redesign the Main Bar UI (`apps/app/src/renderer/src/components/main/`)

1.  **Update `HeaderBar.tsx`**: This component will become the main bar.
    -   Remove existing layout controls (like vertical/horizontal toggle).
    -   Add the new button layout: Listen, Transcriptions, Features, Settings.
2.  **Implement "Listen" Button Logic**:
    -   Connect its `onClick` to the existing `toggleScreenShare` hook.
    -   Implement the hover-to-preview functionality. This can be a new component that appears on hover and contains the `screenPreviewRef` video element.
3.  **Implement "Transcriptions" Button Logic**:
    -   Set its visibility based on the `isScreenSharing` state.
    -   Its `onClick` handler will call `window.electronAPI.send('app:show-transcriptions')`.
4.  **Implement "Features" Pop-up**:
    -   Create a new component, e.g., `FeaturesPopup.tsx`.
    -   Use a library like Radix UI DropdownMenu or Popover, triggered on hover.
    -   Populate it with buttons for "Generate Summary", "View History" (`history:open`), etc.
5.  **Implement "Settings" Pop-up**:
    -   Create a `SettingsPopup.tsx` component.
    -   Similar to the features pop-up, use a hover-activated popover.
    -   Move the contents of `AdvancedSettingsWindow.tsx` into this new pop-up component.

### Step 3: Create the Transcriptions Window UI

1.  **Create a new React component**, e.g., `TranscriptionView.tsx`.
2.  This component will primarily render the `RealTimeSubtitle` component, filling the entire window.
3.  **Update App Routing/Entry**: Modify `App.tsx` or the renderer entry point to handle displaying only this component when the appropriate route/query param is detected (e.g., when loaded in the transcriptions window).

### Step 4: Apply Styling

-   Use Tailwind CSS to apply the glassmorphism effect, rounded corners, and button styles as seen in `concept.html`.
-   Ensure all pop-ups are styled consistently and positioned correctly relative to their trigger buttons.
