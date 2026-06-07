# System-audio-only (mic mute) Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live mic on/off toggle beside the record control so users can transcribe system audio only, with no microphone capture.

**Architecture:** A per-session `micEnabled` flag (default ON, reset every recording start) lives in `useScreenShare`. Toggling it (a) starts/stops the `useSegmentRecorder` mic path and (b) drives a new `micEnabled` prop on `RealTimeAnalysis` whose dedicated effect tears down or re-acquires the transcription mic stream — mirroring the existing "system audio stream change" effect. The control bar renders a mic/mic-off button only while recording. System-audio capture is never touched.

**Tech Stack:** Electron + React 19 + TypeScript, Web Audio (AudioWorklet) + MediaRecorder, lucide-react icons, Tailwind. Tests: Vitest (node env, no DOM) for pure logic; Chrome DevTools Protocol (via the `electron` skill) for live behavior verification.

**Testing approach (decided):** No new test dependencies. Pure toggle-state logic is unit-tested with the existing Vitest. The media/UI side-effects (getUserMedia teardown, worklet disconnect, button wiring) are verified live against the running Electron app over CDP. Launching the dev app happens only on the user's explicit go-ahead (project rule: no auto builds/dev servers).

---

## File Structure

- **Create** `src/renderer/src/lib/micToggle.ts` — pure, dependency-free toggle-state helpers (the only unit-testable logic). One responsibility: define the initial mic state and the toggle transition.
- **Create** `tests/mic-toggle.test.ts` — Vitest unit tests for `micToggle.ts`.
- **Modify** `src/renderer/src/hooks/useScreenShare.ts` — own `micEnabled` state + `toggleMic()`; reset to ON on `startScreenShare`; start/stop the segment-recorder mic path on toggle; expose both.
- **Modify** `src/renderer/src/components/RealTimeAnalysis.tsx` — add `micEnabled` prop, a `micEnabledRef` send-guard, and a dedicated mute/unmute effect that tears down / re-acquires the transcription mic stream.
- **Modify** `src/renderer/src/components/MainControlBar.tsx` — add `micEnabled` + `onToggleMic` props and the toggle button.
- **Modify** `src/renderer/src/components/MainController.tsx` — read `micEnabled`/`toggleMic` from `useScreenShare`; pass to `MainControlBar` and `RealTimeAnalysis`.

---

## Task 1: Pure mic-toggle state helper (TDD)

**Files:**
- Create: `src/renderer/src/lib/micToggle.ts`
- Test: `tests/mic-toggle.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/mic-toggle.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { INITIAL_MIC_ENABLED, toggleMicEnabled } from '../src/renderer/src/lib/micToggle'

describe('micToggle', () => {
  it('defaults to enabled (mic on) for a fresh session', () => {
    expect(INITIAL_MIC_ENABLED).toBe(true)
  })

  it('flips the enabled state on toggle', () => {
    expect(toggleMicEnabled(true)).toBe(false)
    expect(toggleMicEnabled(false)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run tests/mic-toggle.test.ts`
Expected: FAIL — cannot resolve `../src/renderer/src/lib/micToggle` (module does not exist).

- [ ] **Step 3: Write minimal implementation**

Create `src/renderer/src/lib/micToggle.ts`:

```ts
/**
 * Pure state helpers for the microphone on/off toggle.
 *
 * The mic preference is per-session: every recording session starts ON and the
 * choice is never persisted. Keeping these transitions pure makes them testable
 * without a DOM/media harness; all side-effects live in the hooks/components.
 */

/** Mic starts ON at the beginning of every recording session. */
export const INITIAL_MIC_ENABLED = true

/** Flip the mic-enabled state. */
export function toggleMicEnabled(current: boolean): boolean {
  return !current
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run tests/mic-toggle.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/micToggle.ts tests/mic-toggle.test.ts
git commit -m "Feat: Add pure mic-toggle state helper with unit tests"
```

---

## Task 2: Wire `micEnabled` + `toggleMic` into `useScreenShare`

**Files:**
- Modify: `src/renderer/src/hooks/useScreenShare.ts`

This adds the per-session mic state, resets it to ON on every recording start, and starts/stops the segment-recorder mic path on toggle. No automated test (hook needs a DOM/media harness we don't have); verified by typecheck here and CDP in Task 6.

- [ ] **Step 1: Import the pure helper**

At the top of `src/renderer/src/hooks/useScreenShare.ts`, after the existing imports (around line 10), add:

```ts
import { INITIAL_MIC_ENABLED, toggleMicEnabled } from '@/lib/micToggle'
```

- [ ] **Step 2: Add mic state + ref**

Inside `useScreenShare()`, alongside the other `useState` declarations (after line 56, `systemAudioMimeType`), add:

```ts
  const [micEnabled, setMicEnabled] = useState<boolean>(INITIAL_MIC_ENABLED)
  const micEnabledRef = useRef<boolean>(INITIAL_MIC_ENABLED)
```

(`useState` and `useRef` are already imported on line 7.)

- [ ] **Step 3: Add the `toggleMic` action**

Add this `useCallback` after the `useSegmentRecorder()` destructure block (after line 71). It reads/writes `micEnabledRef` to avoid a stale closure and to be safe against StrictMode double-invocation:

```ts
  // Live mic mute/unmute during recording. Default ON; not persisted.
  const toggleMic = useCallback(() => {
    const next = toggleMicEnabled(micEnabledRef.current)
    micEnabledRef.current = next
    setMicEnabled(next)
    if (next) {
      void startMicRecording()
    } else {
      stopMicRecording()
    }
  }, [startMicRecording, stopMicRecording])
```

- [ ] **Step 4: Reset mic to ON on every recording start**

In `startScreenShare()`, in the reset block at the top (after line 301, `setCurrentSystemAudioStream(null)`), add:

```ts
    micEnabledRef.current = INITIAL_MIC_ENABLED
    setMicEnabled(INITIAL_MIC_ENABLED)
```

Leave the existing `await startMicRecording()` call (line 314) unchanged — the mic still starts ON by default.

- [ ] **Step 5: Expose `micEnabled` and `toggleMic`**

In the hook's returned object (the `return { ... }` at line 373), add these two entries (e.g. after `recordingDuration`):

```ts
    micEnabled,
    toggleMic,
```

- [ ] **Step 6: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.web.json`
Expected: No *new* errors referencing `useScreenShare.ts`. (The repo has pre-existing TS errors elsewhere; confirm none are newly introduced in this file.)

> If `tsconfig.web.json` does not exist, run `pnpm exec tsc --noEmit` and apply the same "no new errors in this file" check.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/hooks/useScreenShare.ts
git commit -m "Feat: Add per-session micEnabled state and toggleMic to useScreenShare"
```

---

## Task 3: Mute/unmute the transcription mic path in `RealTimeAnalysis`

**Files:**
- Modify: `src/renderer/src/components/RealTimeAnalysis.tsx`

`RealTimeAnalysis` acquires its own mic stream for the transcription worklet (`connectMicrophoneAudio`, line ~443). We add a `micEnabled` prop, a send-guard ref, and a dedicated effect that tears down (full teardown — stops tracks so the OS mic indicator turns off) or re-acquires the mic, mirroring the existing system-audio-stream effect at lines 627-662. `micEnabled` is deliberately kept OUT of the main pipeline effect's dependency array so toggling does not restart transcription.

- [ ] **Step 1: Add `micEnabled` to the props interface**

In `RealTimeAnalysisProps` (lines 15-24), add the prop:

```ts
interface RealTimeAnalysisProps {
  onTextResponse?: (
    text: string,
    turnComplete: boolean,
    sourceType?: 'microphone' | 'system'
  ) => void // 當收到文字回應時的回呼
  systemAudioStream?: MediaStream
  isScreenSharing: boolean
  customPrompt?: string
  micEnabled?: boolean
}
```

- [ ] **Step 2: Destructure the prop**

In the component signature (lines 26-31), add `micEnabled = true`:

```ts
export default function RealTimeAnalysis({
  onTextResponse,
  systemAudioStream,
  isScreenSharing,
  customPrompt,
  micEnabled = true
}: RealTimeAnalysisProps) {
```

- [ ] **Step 3: Add a send-guard ref**

Among the refs near the top of the component (after line 60, `micMediaStreamRef`), add:

```ts
  const micEnabledRef = useRef<boolean>(true)
```

- [ ] **Step 4: Gate mic PCM forwarding with the ref (belt-and-suspenders)**

In the mic worklet `onmessage` handler, update the "Handle regular audio data" condition (currently line 378):

```ts
          // Handle regular audio data
          if (
            micProcessor &&
            shouldSendAudio &&
            micEnabledRef.current &&
            sourceType === 'microphone' &&
            pcmData
          ) {
```

This drops any in-flight mic chunks during teardown. The real guarantee is the stream teardown in Step 5.

- [ ] **Step 5: Add the mute/unmute effect**

Immediately after the existing "Separate effect to handle system audio stream changes" effect (after line 662, before `return null`), add a new effect. It bails until the pipeline is ready (refs set by the main effect's initial connect), so the initial on-start mic connect is owned by the main effect and this effect only handles subsequent toggles:

```ts
  // Separate effect to mute/unmute the microphone live, without restarting
  // transcription. Full teardown on mute (stops tracks → OS mic indicator off);
  // re-acquire on unmute. Mirrors the system-audio reconnect effect above.
  useEffect(() => {
    if (!isScreenSharing) return
    micEnabledRef.current = micEnabled

    const audioContext = audioContextRef.current
    const micWorkletNode = micAudioWorkletNodeRef.current
    // Pipeline not ready yet on first mount; the main effect's initial connect
    // handles startup. This effect only acts on later toggles.
    if (!audioContext || !micWorkletNode) return

    let cancelled = false

    if (micEnabled) {
      const alreadyLive = micMediaStreamRef.current
        ?.getTracks()
        .some((track) => track.readyState === 'live')
      if (alreadyLive) return

      ;(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop())
            return
          }
          micMediaStreamRef.current = stream

          const micAnalyser = audioContext.createAnalyser()
          micAnalyser.fftSize = 256
          micAnalyserRef.current = micAnalyser

          const micSource = audioContext.createMediaStreamSource(stream)
          micAudioSourceRef.current = micSource

          micSource.connect(micAnalyser)
          micAnalyser.connect(micWorkletNode)
          console.log('[RealTimeAnalysis] Microphone unmuted and reconnected')
        } catch (error) {
          // getUserMedia can reject (permission revoked); leave mic effectively
          // off and keep the session alive.
          console.error('[RealTimeAnalysis] Error re-acquiring microphone on unmute:', error)
        }
      })()
    } else {
      if (micAudioSourceRef.current) {
        micAudioSourceRef.current.disconnect()
        micAudioSourceRef.current = null
      }
      if (micAnalyserRef.current) {
        micAnalyserRef.current.disconnect()
        micAnalyserRef.current = null
      }
      if (micMediaStreamRef.current) {
        micMediaStreamRef.current.getTracks().forEach((track) => track.stop())
        micMediaStreamRef.current = null
      }
      console.log('[RealTimeAnalysis] Microphone muted and torn down')
    }

    return () => {
      cancelled = true
    }
  }, [micEnabled, isScreenSharing])
```

- [ ] **Step 6: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.web.json`
Expected: No new errors referencing `RealTimeAnalysis.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/RealTimeAnalysis.tsx
git commit -m "Feat: Mute/unmute transcription mic stream via micEnabled prop"
```

---

## Task 4: Add the toggle button to `MainControlBar`

**Files:**
- Modify: `src/renderer/src/components/MainControlBar.tsx`

- [ ] **Step 1: Import `MicOffIcon`**

Update the `lucide-react` import (lines 3-10) to add `MicOffIcon`:

```ts
import {
  MicIcon,
  MicOffIcon,
  SettingsIcon,
  LayoutGrid,
  MonitorIcon,
  MessageSquare,
  Loader2
} from 'lucide-react'
```

- [ ] **Step 2: Add props to the interface**

In `MainControlBarProps` (lines 14-26), add:

```ts
  micEnabled: boolean
  onToggleMic: () => void
```

- [ ] **Step 3: Destructure the new props**

In the component parameter destructure (lines 28-36), add `micEnabled` and `onToggleMic`:

```ts
export function MainControlBar({
  isScreenSharing,
  onToggleScreenShare,
  isSummarizing,
  recordingDuration,
  onTogglePanel,
  openPanels,
  isSettingsOpen,
  micEnabled,
  onToggleMic
}: MainControlBarProps) {
```

- [ ] **Step 4: Render the toggle button**

Inside the `{isScreenSharing && (<> ... </>)}` group, add the mic toggle as the FIRST button (immediately after the opening `<>` on line 74, before the Screen Preview button):

```tsx
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleMic}
              className={`h-8 w-8 rounded-full shadow hover:bg-white ${
                micEnabled ? '' : 'bg-destructive/80 text-white hover:text-black'
              }`}
              title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
              aria-pressed={!micEnabled}
            >
              {micEnabled ? (
                <MicIcon className="h-4 w-4" />
              ) : (
                <MicOffIcon className="h-4 w-4" />
              )}
            </Button>
```

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.web.json`
Expected: No new errors in `MainControlBar.tsx`. (It will report that `MainController` does not yet pass `micEnabled`/`onToggleMic` only once we save — that is fixed in Task 5; if tsc flags the call site now, proceed to Task 5 to resolve it.)

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/MainControlBar.tsx
git commit -m "Feat: Add mic mute/unmute toggle button to control bar"
```

---

## Task 5: Wire the toggle through `MainController`

**Files:**
- Modify: `src/renderer/src/components/MainController.tsx`

- [ ] **Step 1: Read `micEnabled` and `toggleMic` from the hook**

In the `useScreenShare()` destructure (lines 23-29), add the two new values:

```ts
  const {
    isScreenSharing,
    toggleScreenShare,
    restartScreenShare,
    currentSystemAudioStream,
    recordingDuration,
    micEnabled,
    toggleMic
  } = useScreenShare()
```

- [ ] **Step 2: Pass props to `MainControlBar`**

In the `<MainControlBar ... />` JSX (lines 388-400), add:

```tsx
        micEnabled={micEnabled}
        onToggleMic={toggleMic}
```

- [ ] **Step 3: Pass `micEnabled` to `RealTimeAnalysis`**

In the `<RealTimeAnalysis ... />` JSX (lines 401-407), add:

```tsx
        micEnabled={micEnabled}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.web.json`
Expected: No new errors in `MainController.tsx`, `MainControlBar.tsx`, or `RealTimeAnalysis.tsx`.

- [ ] **Step 5: Run the full unit test suite**

Run: `pnpm test:run`
Expected: All tests pass, including `tests/mic-toggle.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/MainController.tsx
git commit -m "Feat: Wire mic toggle through MainController to bar and analysis"
```

---

## Task 6: Live verification over Chrome DevTools Protocol

**Goal:** Confirm the acceptance criteria against the running Electron app. This task requires launching the dev app — **do this only after the user gives an explicit go-ahead** (project rule: no auto builds/dev servers). Use the `electron` skill to attach over CDP.

- [ ] **Step 1: Launch the dev app with remote debugging (user-initiated)**

Ask the user to start the app, or — once greenlit — launch it so the renderer exposes a CDP target. Either:

```bash
# Option A: env switch picked up by Electron/Chromium
ELECTRON_EXTRA_LAUNCH_ARGS=--remote-debugging-port=9222 pnpm dev
```

or use the `electron` skill, which launches/attaches to the Electron app over CDP automatically. Confirm a renderer target is reachable (CDP `Target.getTargets` lists the main window page).

- [ ] **Step 2: Start a recording and confirm mic starts ON**

Drive the UI: click the Listen button (start screen share / recording). In the renderer, evaluate over CDP:

```js
// Expect a live mic audio track shortly after recording starts (mic default ON)
[...document.querySelectorAll('button')].map(b => b.title)
```

Expected: the control bar now shows a button with title `"Mute microphone"` (mic on).

- [ ] **Step 3: Mute and verify full teardown + system-only transcription**

Click the mic toggle. Then over CDP read the renderer console (filter pattern `Microphone muted`) and verify:

- Console logs `[RealTimeAnalysis] Microphone muted and torn down`.
- The button title is now `"Unmute microphone"` and shows the `MicOffIcon`.
- The macOS microphone-in-use indicator (orange dot / Control Center) turns OFF.
- With audio playing from another app, new transcriptions continue to arrive tagged `system` only — no `microphone`-sourced lines. Confirm via the Transcriptions panel and/or console (`transcription:data` logs show `sourceType: 'system'`).

- [ ] **Step 4: Unmute and verify mic resumes**

Click the toggle again. Verify over CDP:

- Console logs `[RealTimeAnalysis] Microphone unmuted and reconnected`.
- The macOS mic indicator turns back ON.
- Speaking produces `microphone`-sourced transcriptions again.

- [ ] **Step 5: Verify per-session reset**

Stop recording, then start a new recording. Confirm the mic toggle is back to ON (title `"Mute microphone"`) regardless of its state in the previous session.

- [ ] **Step 6: Record results**

Note the outcome of each check. If any fails, debug with `superpowers:systematic-debugging` before marking the plan complete. No commit (verification only).

---

## Self-Review

**Spec coverage:**
- Toggle next to record control, state visible at a glance → Task 4 (button with Mic/MicOff icon + destructive tint), Task 5 (wiring).
- Mic-off → system audio only, no bleed → Task 3 (full stream teardown + send-guard), Task 2 (segment-recorder stop), verified in Task 6 Step 3.
- Mic starts ON each session, live toggle, not persisted → Task 1 (`INITIAL_MIC_ENABLED`), Task 2 (reset on start + toggle), Task 6 Step 5 (reset check).
- System capture unaffected → guaranteed by independence (no changes to the system-audio path); verified Task 6 Step 3.
- Non-goals (Windows, settings UI, persistence) → no tasks touch them. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; every command has expected output. ✓

**Type consistency:** `micEnabled: boolean` and `onToggleMic: () => void` / `toggleMic` are used consistently across `useScreenShare` (exposes `micEnabled`, `toggleMic`), `MainController` (forwards as `onToggleMic`/`micEnabled`), `MainControlBar` (`micEnabled`, `onToggleMic`), and `RealTimeAnalysis` (`micEnabled` prop). Helper names `INITIAL_MIC_ENABLED` / `toggleMicEnabled` match between `micToggle.ts`, its test, and `useScreenShare`. ✓
