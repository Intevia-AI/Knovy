# System-audio-only (mic mute) toggle — Design

**Date:** 2026-06-07
**Status:** Approved (design)
**Scope:** macOS desktop app (Knovy renderer + audio capture layer)

## Problem

Users transcribing tutorials, videos, or audio messages from other apps (YouTube,
Udemy, Coursera, Instagram, Threads, etc.) do not want their own microphone
captured. Today, starting a recording always captures both the microphone and
system audio. There is no way to record system audio alone.

## Goal

Add a microphone on/off toggle beside the record control (Google-Meet "mute"
mental model). When the mic is off, only system audio is captured and
transcribed, with no microphone bleed.

## Behavior (decided)

- **Default ON.** The mic always starts ON when a recording begins.
- **Not persisted.** Every recording session resets the mic to ON. The toggle
  state is per-session only; it is not written to `settings.json`.
- **Visible only while recording.** The toggle button appears in the control bar
  only when `isScreenSharing === true`, alongside the existing Preview /
  Transcriptions / Actions buttons.
- **Live toggle.** Flipping the toggle mid-recording mutes/unmutes the mic on the
  fly. System-audio capture is never affected by the toggle.
- **Full teardown on mute (option A).** Muting stops the microphone `MediaStream`
  tracks entirely (both acquisition paths). No microphone PCM is produced and the
  OS "microphone in use" indicator turns off. Unmuting re-acquires the mic.

## Non-goals

- **Windows support.** System-audio capture has no loopback path on Windows today
  (it relies on macOS ScreenCaptureKit loopback via Electron's
  `setDisplayMediaRequestHandler`). This feature is therefore effectively
  macOS-only; no Windows work is included.
- **Settings-page UI.** The only control is the in-bar toggle. No entry is added
  to the settings screen.
- **Persisted preference.** Explicitly out of scope per the decision above.

## Current architecture (relevant)

System audio and microphone are captured **independently**:

- **System audio** comes from `navigator.mediaDevices.getDisplayMedia({ video,
  audio })`. Electron's `setDisplayMediaRequestHandler` (`src/main/index.ts`)
  returns `{ video: source, audio: 'loopback' }`, so macOS supplies system audio
  via loopback. The audio tracks are extracted in
  `useScreenShare.startScreenShare()` (`src/renderer/src/hooks/useScreenShare.ts:317-321`)
  and fed to a dedicated `MediaRecorder` + `system-audio-processor.js` worklet.
- **Microphone** is acquired in **two** independent places:
  1. `useSegmentRecorder.start()` → `getUserMedia({ audio: true })` →
     `MediaRecorder` → `mic_segment` webm blobs
     (`src/renderer/src/hooks/useSegmentRecorder.ts:100`). Started from
     `useScreenShare.startScreenShare()` (`useScreenShare.ts:314`).
  2. `RealTimeAnalysis.connectMicrophoneAudio()` → its own
     `getUserMedia({ audio: true })` → `mic-audio-processor.js` worklet → PCM →
     whisper transcription (`src/renderer/src/components/RealTimeAnalysis.tsx:443`).
     **This is the path that feeds live transcription.**

Because the two streams are independent, disabling the mic does not affect system
capture. There is no shared `AudioContext` coupling between mic and system on the
capture side. `sourceType` (`'microphone'` | `'system'`) is hard-coded per worklet
and flows cleanly through IPC to the DB.

## Design

### State ownership

`micEnabled` lives in the **`useScreenShare`** hook:

- Initialized to `true`.
- Reset to `true` at the start of every `startScreenShare()` (per-session default).
- Exposed alongside a `toggleMic()` action.

`MainController` reads `micEnabled` + `toggleMic` from `useScreenShare` and passes:

- `micEnabled` + `onToggleMic` → `MainControlBar` (renders the button).
- `micEnabled` → `RealTimeAnalysis` (drives the transcription mic path).

Co-locating `micEnabled` with the recording lifecycle keeps mute state and
recording state in one place.

### Control: both acquisition points

`toggleMic()` and the `micEnabled` prop together control both mic paths so that
"off" means truly off:

1. **`useSegmentRecorder` path** — `toggleMic()` calls `stopMicRecording()` when
   turning off and `startMicRecording()` when turning back on.
2. **`RealTimeAnalysis` path** — a new `micEnabled` prop drives a dedicated effect:
   - **Off:** stop `micMediaStreamRef` tracks and disconnect `micAudioSource` /
     `micAnalyser` from the mic worklet node. No PCM is produced.
   - **On:** re-run `connectMicrophoneAudio()` to re-acquire and reconnect.

   This requires lifting `connectMicrophoneAudio()` and its teardown out of the
   one-shot `isScreenSharing` effect (currently defined inline) so they can be
   invoked on toggle without tearing down the whole transcription pipeline.

   Belt-and-suspenders: a `micEnabledRef` guard at the worklet `onmessage` mic
   branch (`RealTimeAnalysis.tsx:378`) drops any in-flight chunks during teardown.

### UI: toggle button

In `MainControlBar.tsx`, inside the existing `{isScreenSharing && (...)}` group,
add a button as the first item after the Listen/timer button:

- `variant="ghost" size="icon"`, `h-8 w-8 rounded-full shadow` to match siblings.
- `MicIcon` when enabled, `MicOffIcon` when muted (both from `lucide-react`).
- A clear muted state (e.g. red tint on the muted button) so state is visible at a
  glance.
- `onClick={onToggleMic}`, `title` reflecting current state ("Mute microphone" /
  "Unmute microphone").
- New props on `MainControlBarProps`: `micEnabled: boolean`,
  `onToggleMic: () => void`.

## Acceptance criteria

- [ ] A mic on/off toggle sits next to the record control and its state (on vs
      muted) is visible at a glance.
- [ ] With the mic off, transcription is produced from system audio only, with no
      microphone-sourced transcription (`sourceType: 'microphone'`) and the OS mic
      indicator is off.
- [ ] Mic starts ON each session; toggling works live during recording and the
      preference does not persist across recordings.
- [ ] System-audio capture is unaffected by toggling the mic (verified by
      continued `sourceType: 'system'` transcriptions while muted).

## Edge cases

- **Toggle mid-recording:** supported (live). Both mic paths start/stop on toggle.
- **No system audio playing while muted:** expected to yield no transcription;
  this is correct behavior, not an error.
- **Mute → unmute → mute rapidly:** teardown/re-acquire must be idempotent; guard
  against double-stop / double-acquire of the mic stream.
- **macOS mic permission denied:** unmuting re-acquires via `getUserMedia`, which
  may reject; failure must not crash the session — log and leave mic effectively
  off.

## Testing

- Unit/behavioral coverage where feasible (Vitest) for `useScreenShare`'s
  `micEnabled` reset-on-start and `toggleMic` start/stop wiring.
- Manual verification on macOS: start recording, confirm mic on; mute and confirm
  (a) OS mic indicator off, (b) only `system` transcriptions continue, (c) unmute
  resumes mic transcriptions.
