# Plan: Highlight and Actionize Keywords in Transcriptions

**Date:** 2025-09-14
**Ticket:** #HighlightKeywords

## 1. Goal

The primary goal is to enhance the transcription feature by highlighting extracted keywords directly within the transcription text. These highlighted keywords should be clickable, triggering a web search in the "Actions Panel".

## 2. Architecture & Strategy

We will modify the data flow from the `geminiClient` to embed keywords into the transcription string using Markdown's backtick syntax for code blocks (e.g., `` `keyword` ``). The frontend will then be adapted to render these as interactive elements. Communication between the `ChatPanel` and `ActionsPanel` (which are separate popover windows) will be orchestrated via Electron's IPC mechanism through the main process to ensure they are decoupled.

### Key Components Involved:

-   **Data Processing:** `geminiClient.ts`, `RealTimeAnalysis.tsx`
-   **UI/Rendering:** `ChatPanel.tsx`, `markdown.tsx`
-   **State & Actions:** `useAIInteraction.ts`, `ActionsPanel.tsx`
-   **Orchestration:** `MainController.tsx`, `main/index.ts`, `preload/index.ts`

## 3. Task Breakdown & Agent Assignments

### Task 1: Embed Keywords into Transcription Stream

-   **Description:** Modify the Gemini client-side logic to merge keywords into the transcription text. Instead of two separate callbacks (`onTextResponse`, `onKeywords`), we will have a single stream that includes keywords formatted with backticks.
-   **Files to Modify:**
    -   `apps/app/src/renderer/src/components/RealTimeAnalysis.tsx`: Update the `onmessage` handler to find and replace keywords in the transcription text, wrapping them with backticks.
    -   `apps/app/src/renderer/src/lib/geminiClient.ts`: Review to ensure the parsing logic correctly handles the combined stream from the proxy. The primary change will likely be in `RealTimeAnalysis.tsx`.
    -   `apps/app/src/renderer/src/hooks/useAIInteraction.ts`: The `handleTranscriptionKeywords` function will no longer be needed. The `handleTranscriptionResponse` will now receive the pre-formatted string.
-   **Agent:** `@agents/universal/frontend-developer`

### Task 2: Implement IPC for Inter-Panel Keyword Actions

-   **Description:** Create an IPC channel to allow the `ChatPanel` to trigger an action that both opens the `ActionsPanel` and initiates a search within it.
-   **Files to Modify:**
    -   `apps/app/src/preload/index.ts`: Add a new channel to the `send` whitelist, e.g., `keyword:click`. Add a new channel to the `on` whitelist, e.g., `keyword:search`.
    -   `apps/app/src/main/index.ts`: Add a listener for `ipcMain.on('keyword:click', (event, keyword) => { ... })`. This handler will broadcast a `keyword:search` event to all `BrowserWindow` instances.
-   **Agent:** `@agents/universal/backend-developer`

### Task 3: Update UI to Render and Handle Clickable Keywords

-   **Description:** Modify the Markdown renderer to style keywords distinctly and handle click events. The click handler will trigger the new IPC event from Task 2.
-   **Files to Modify:**
    -   `apps/app/src/renderer/src/components/markdown.tsx`: Customize the `code` component. It should render as a clickable element (e.g., with `cursor: pointer`, a specific color). The `onClick` handler will call `window.electronAPI.send('keyword:click', keyword)`.
    -   `apps/app/src/renderer/src/assets/globals.css`: Add styling for the highlighted keywords if needed.
-   **Agent:** `@agents/specialized/react-component-architect`

### Task 4: Orchestrate Panel Management and Keyword Search

-   **Description:** Tie everything together. The `MainController` will manage opening the `ActionsPanel`, and the `ActionsPanel` itself will listen for the event and trigger the search.
-   **Files to Modify:**
    -   `apps/app/src/renderer/src/components/main/MainController.tsx`: Add a `useEffect` hook to listen for the `keyword:search` IPC event. When received, it will call `handleTogglePanel('actions')` to ensure the panel is visible and positioned correctly.
    -   `apps/app/src/renderer/src/components/main/ActionsPanel.tsx`: Add a `useEffect` hook to also listen for the `keyword:search` IPC event. When received, it will call its local `sendContextToAI('keyword_search', keyword)` function to perform the search. This ensures the action is executed within the correct component's context.
-   **Agent:** `@agents/specialized/react-nextjs-expert`

## 4. Execution Order

1.  **Phase 1 (Parallel):**
    -   Task 1: Embed Keywords
    -   Task 2: Implement IPC
2.  **Phase 2 (Sequential):**
    -   Task 3: Update UI (Can begin once Task 1's data format is clear).
3.  **Phase 3 (Sequential):**
    -   Task 4: Orchestrate and Integrate (Depends on all previous tasks).

## 5. Considerations

-   **Styling:** The clickable keywords should be visually distinct but not distracting. A subtle color change and pointer on hover should suffice.
-   **Race Conditions:** The IPC implementation must be robust. Broadcasting from `main` to all windows is a reliable way to decouple the renderer processes and avoid race conditions where the `ActionsPanel` might not be ready to receive a direct message.
-   **User Experience:** When a keyword is clicked, the `ActionsPanel` should appear smoothly. The loading state for the search should be clearly indicated within the `ActionsPanel`.
