# Model Download UX & Recording Gate — Design

**Date:** 2026-06-07
**Branch:** `feature/model-download-ux` (off `stg`)
**Status:** Approved design — pending implementation plan

## Problem

Settings exposes 4 Ollama models. Selecting a model sets it active but never downloads
it, so the app can record against a model that does not exist yet — the recording proceeds
with no blocking UI and no signal that the model is not ready, producing raw (un-corrected)
transcription silently. There is also no defined behavior when the user has deleted all
models, or never runs Ollama at all.

The user should keep the choice: some deliberately do not want the LLM running (memory or
other reasons) and should be able to record raw transcription, but only as an explicit,
informed decision — never as a silent failure.

## Goals / Acceptance Criteria

- Recording cannot silently start against a non-ready model.
- Switching a model shows a loading state with progress.
- Download failure shows an actionable error, not a silent stuck state.
- In-flight recording + model switch has defined behavior.
- The "no model / never runs Ollama" path is graceful and gives the user the choice.

## Non-Goals (explicitly out of scope)

- Filesystem probing to distinguish "Ollama not installed" from "not running".

---

## Design

### 1. Two-layer state model

**Layer A — `aiCorrection: 'on' | 'off'`** — persisted in `settings.json`, default `'on'`.
The user's standing intent. `'off'` means "I don't want the LLM": always record raw, no
gating, no enhancement attempt.

**Layer B — model lifecycle** — owned by `ollamaService` in the main process; only
meaningful when `aiCorrection === 'on'`:

```
idle → downloading → verifying → ready → error
```

- `idle` — no active model installed
- `downloading` — pull streaming (carries `progress` %)
- `verifying` — Ollama's verify phase + post-pull `/api/tags` confirmation
- `ready` — active model confirmed present
- `error` — pull failed / Ollama unavailable (carries a classified reason)

### 2. Recording gate

Evaluated at record-time, implemented as a pure, unit-testable function:

`decideRecordAction({ aiCorrection, phase, ollamaReachable })`:

| Condition | Action |
|---|---|
| `aiCorrection === 'off'` | start **raw** (no checks) |
| `phase === 'ready'` | fresh re-verify, then start **enhanced** |
| `phase === 'idle'` (no model) | **choice dialog**: `Download a model` / `Record raw now` / `Don't ask again`(→sets `off`) |
| `phase === 'downloading' \| 'verifying'` | **block dialog**: live progress + `Record raw now`; record button auto-usable once `ready` |
| `phase === 'error'` or Ollama unreachable | **block dialog**: classified message + `Retry` / `Start/Install Ollama` guidance + `Record raw now` |

"Record raw now" inside a block dialog is **per-attempt** and does **not** flip the
persisted `aiCorrection` preference. Only the explicit "Don't ask again" affordance does.

### 2a. Model catalog

The selectable catalog is updated (replacing the old `qwen2.5`/`gemma3` set). All four
tags verified against the live Ollama registry manifest API.

| Tag | Label | Note |
|---|---|---|
| `qwen3.5:2b` | Qwen 3.5 2B | Lightweight, fastest, lowest memory |
| `qwen3.5:4b` | Qwen 3.5 4B | Balanced speed + quality (text + vision) |
| `gemma4:e2b` | Gemma 4 E2B | Google, fast, low memory |
| `gemma4:e4b` | Gemma 4 E4B | **Recommended** — vision + quality |

`RECOMMENDED_MODEL = 'gemma4:e4b'` — suggested in the fresh-install "Download a model"
prompt and used as the default selected model. `DEFAULT_MODEL` in `ollamaService.ts`
updates to match.

### 3. Settings (`OllamaSettings.tsx`) — unify select & download

- Selecting a not-installed model **drives the whole lifecycle** automatically
  (downloading → verifying → ready) with inline progress + model name. No separate pull
  button.
- Selecting an already-installed model is an instant swap.
- **Cancel** button during download. Selecting a different model **supersedes** (aborts)
  the in-flight pull. One pull at a time; stale progress events ignored. Ollama keeps
  partial blobs, so a re-pull resumes rather than restarting.
- New **AI auto-correction on/off** toggle (Layer A) with copy explaining that off = raw
  transcription, no LLM.
- **Finish-then-switch**: if a recording is active, the selector still works but sets a
  *pending* model with a "Will switch to X after recording ends" indicator; the switch
  (and download, if needed) is applied when recording stops.

### 4. Record surface (`useScreenShare.ts` / `MainController.tsx`)

- `startScreenShare()` consults the gate before capturing media.
- Record button reflects state: disabled with "Preparing model… 47%" while not ready;
  clicking when blocked opens the appropriate dialog.
- Download stays in the background — only recording is gated; the rest of the app remains
  usable.

### 5. IPC / main changes

- Broadcast a single `ollama:model-state` `{ phase, model, progress, error, aiCorrection }`
  (folds in today's `ollama:pull-progress` and `ollama:status-changed`) so Settings and the
  record button stay in sync.
- `ollama:cancel-pull` — aborts the active pull via `AbortController`.
- `pullModel` gains: abort signal support, `verifying` phase emission, and **error
  classification** (disk-full / network-offline / generic → actionable messages).
- `aiCorrection` added to settings load/save with a getter exposed to the renderer.
- `isModelReady(model)` — fresh `/api/tags` check used by the gate and to catch out-of-band
  deletion.

### 6. Edge cases

| Case | Behavior |
|---|---|
| Partial / interrupted download | Ollama resumes on re-pull; on restart, missing model → not-ready, re-select resumes |
| Disk-full | pull error → `error` phase, "Not enough disk space" message + Retry + raw escape |
| Model deleted out-of-band | record-time re-verify flips `ready`→`idle`; status monitor also catches it |
| Rapid toggling | supersede: abort prior pull, ignore stale progress |
| Offline / Ollama down | `error` / unavailable → guidance + Retry + raw escape |

### 7. Testing

- **Unit (Vitest):**
  - `decideRecordAction` truth table across all `{aiCorrection, phase, ollamaReachable}`
    combinations.
  - Error classifier (disk / network / generic → message keys).
  - Pull-progress parsing (Ollama stream events → `progress` %, phase transitions).
  - State-machine transitions including supersede / cancel.
  - These are pure functions, extracted so they run without Electron.
- **Chrome DevTools (CDP) on the running app:**
  - Switch model → progress shown.
  - Record blocked mid-download; "Record raw now" escape works.
  - No-model choice dialog (download / raw / don't-ask-again).
  - Error → Retry path.
  - Finish-then-switch indicator and post-recording application.

---

## Decisions Log (from grill)

1. Three-way gating rule: hard-block only when selected model is not-ready; allow opt-in
   raw when zero models; record normally when ready.
2. In-flight switch: **finish-then-switch** (queue, apply after recording stops).
3. Select drives the full download lifecycle (unify select + pull).
4. "Blocking" = block recording only; background download; app stays usable.
5. Raw choice persists as a preference (`aiCorrection: 'off'`) with "don't ask again".
6. Every non-ready state offers a per-attempt "Record raw now" escape (does not flip the
   persisted preference).
7. Fresh install defaults AI-correction ON with a one-time prompt; unreachable Ollama is
   treated uniformly as "unavailable" with install/start guidance.
8. Downloads are cancellable; rapid switching supersedes the in-flight pull.
9. Model catalog updated to `qwen3.5:2b`, `qwen3.5:4b`, `gemma4:e2b`, `gemma4:e4b`
   (recommended default `gemma4:e4b`); tags verified against the live Ollama registry.
   Ollama-install detection remains out of scope.
