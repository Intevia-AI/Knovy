# Plan: Coexistence of Chat and Actions Panels

This plan details the technical implementation for allowing the Chat and Actions panels to be open simultaneously, providing a more flexible and powerful user experience.

## 1. Goal

Refactor the popover management system to allow the `ChatPanel` and `ActionsPanel` to be open at the same time. The layout and transitions must be fluid and intuitive.

- **Single Panel Open:** The panel is centered above the main control bar.
- **Both Panels Open:** The `ChatPanel` is on the left, `ActionsPanel` is on the right, arranged symmetrically with a 16px gap.
- **Transitions:** All state changes (opening/closing one or both panels) must be smoothly animated.

## 2. Architectural Approach

We will modify the existing popover architecture, which uses Electron's `BrowserWindow` for each panel. The core changes will be in the renderer process (`MainController.tsx`), which will become the central orchestrator for panel state and positioning.

1.  **State Management:** A `Set` will be used in `MainController.tsx` to track all open panels, serving as the single source of truth.
2.  **Layout Calculation:** A unified `handleTogglePanel` function will calculate the required positions for all panels based on the new state.
3.  **Window Orchestration:** The `handleTogglePanel` function will issue commands to the main process (`popover:create`, `popover:close`, and a modified `popover:resize`) to create, close, or reposition the panel windows.
4.  **Animation:** We will use Electron's built-in animated `setBounds` capability on macOS for smooth panel transitions. The existing `motion` (remember, it's now called `motion`, not `framer-motion`) animations within each panel's content will be preserved.

## 3. Task Breakdown & Agent Assignment

### Task Analysis

- The project requires a refactor of the panel management logic in an Electron/React application.
- The main process (Node.js/Electron) and renderer process (React/TypeScript) will both be modified.
- The goal is to enable a more complex UI state (multiple open panels) while maintaining a high-quality, animated user experience.

### SubAgent Assignments

1.  **Task 1: Enhance Main Process Panel Controls**
    - **Description:** Modify the main process to allow for explicit positioning of popover windows. The existing `resizePopover` function will be updated to accept `x` and `y` coordinates, making it a versatile `reposition` tool.
    - **Agent:** `@agents/universal/backend-developer`

2.  **Task 2: Refactor Renderer State Management**
    - **Description:** In `MainController.tsx`, replace the current single-panel state (`activePopover`) with a new state variable (`openPanels`) that can track multiple open panels simultaneously using a `Set`.
    - **Agent:** `@agents/specialized/react-nextjs-expert`

3.  **Task 3: Implement Panel Layout Orchestration**
    - **Description:** Create a new `handleTogglePanel` function in `MainController.tsx`. This function will contain the core logic for the feature, calculating the correct layout for all possible states (0, 1, or 2 panels) and issuing the appropriate IPC commands to the main process to create, close, or move the panels.
    - **Agent:** `@agents/specialized/react-nextjs-expert`

4.  **Task 4: Update UI and Event Wiring**
    - **Description:** Update `MainControlBar.tsx` to work with the new `openPanels` state. The button's active state and `onClick` handlers will be wired to the new `handleTogglePanel` function and the `openPanels` set.
    - **Agent:** `@agents/specialized/react-nextjs-expert`

### Execution Order

- **Sequential**: Task 1 (main process changes must be done first).
- **Sequential**: Task 1 → Task 2 → Task 3 → Task 4. The frontend tasks build upon each other.

### Available Agents for This Project

- `@agents/universal/backend-developer`: Best suited for the Electron main process logic (Node.js environment).
- `@agents/specialized/react-nextjs-expert`: The ideal choice for all React, state management, and component logic in the renderer process.

### Instructions to Main Agent

1.  Delegate **Task 1** to `@agents/universal/backend-developer`.
2.  Upon completion, delegate **Task 2** to `@agents/specialized/react-nextjs-expert`.
3.  Upon completion, delegate **Task 3** to `@agents/specialized/react-nextjs-expert`.
4.  Upon completion, delegate **Task 4** to `@agents/specialized/react-nextjs-expert`.
5.  After all tasks are complete, the feature implementation will be finished.
