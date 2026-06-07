# Raw Transcription + Streaming Correction — Design

**Date:** 2026-06-07
**Status:** Approved (design); pending implementation plan

## Problem

The transcription pipeline currently runs Ollama "enhancement" as a blocking,
structured-JSON call (`{ corrected, intention, keywords, confidence }`) inside the
`transcription:data` main-process handler. The corrected text only appears once the
entire JSON response is parsed — the user waits on a blocking lump with no feedback.
The Markdown keyword-highlighting rendering layered on top adds no value.

## Goals

- Remove keyword highlighting entirely.
- Stream correction token-by-token so corrected text renders incrementally.
- Handle mid-stream cancel (user stops / new recording) with no leaked connection.
- Persist the final corrected text to session history once a stream completes.

## Non-Goals / Removed Behavior

- **Intention detection + auto-trigger** (`IntentionProcessor.processEnhancedSegment`)
  is removed. Correction-only output has no intention field, so the intention-based
  auto-triggering of AI actions goes away with this change. _(Confirmed acceptable.)_
- **Keywords / confidence metadata** are no longer produced or stored.
- No new web framework. No Express/HTTP/SSE server — the app is pure Electron IPC,
  which already streams. SSE would only make sense across an HTTP boundary, which does
  not exist here.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Transport | Electron IPC (`webContents.send` per chunk) — no Express/SSE |
| Correction trigger | Per finalized whisper segment (existing grain) |
| Correction output | Plain text, streamed (no JSON `format` schema) |
| Display library | Build on existing shadcn/Tailwind primitives (no new dep) |
| Cancel persistence | Discard partial; persist **raw** with `status='cancelled'` |
| Raw display | Show raw **only** when Ollama is unavailable; when Ollama is ready, show only the streamed correction (no raw flash) |

## Architecture

### Data flow

```
whisper segment → transcription:data (main process)
  ├─ save raw to DB (enhancement_status='pending')                [exists]
  │
  ├─ if Ollama NOT ready:
  │     broadcast transcription:data with RAW text   (fallback, current behavior)
  │
  └─ if Ollama ready:
        broadcast transcription:data as a correction placeholder
          (no raw text shown — bubble opens empty, streaming)
        enqueue streaming correction for { transcriptId, generationId }
            ↓ Ollama POST /api/chat  { stream: true }   (plain text, no format)
            per NDJSON chunk → correction:token { generationId, transcriptId, chunk }
            on finish        → correction:done  { generationId, transcriptId, fullText }
                               update DB: enhanced_text + content, status='completed'
            on stall/abort   → correction:cancelled/error; keep raw, status='cancelled'
```

When Ollama is ready, the raw text is never broadcast for display — the bubble opens in
a streaming state and corrected text flows in. Raw text is still saved to the DB (it is
the source for the correction and the fallback if the stream is cancelled).

### Components / units

#### 1. Correction service — `src/main/ollamaService.ts`

- New method `enhanceStream(segment, sessionContext, { onToken, signal })`:
  - `POST /api/chat` with `stream: true`, **no `format`** field.
  - Reads `response.body` as an NDJSON stream; for each line, calls
    `onToken(json.message.content)` and accumulates.
  - Resolves with the concatenated full corrected text.
  - Honors an external `AbortSignal` (cancel) and an internal **inactivity timeout**
    that resets on every received token (detects mid-stream stalls). On stall → abort
    → caller falls back to raw.
- Keep the sequential `inferenceQueue` (one Ollama call at a time), but the enhance
  item now streams via `enhanceStream`.
- **Remove** the structured path: `runInference`, `enhanceSingleSegment`,
  `retryInference`, the JSON-schema usage, and the `EnhanceResponse`/`EnhancedSegment`
  intention/keywords fields that are no longer produced.

#### 2. Main handler — `src/main/index.ts` (`transcription:data`)

- Save raw (unchanged).
- Branch on `ollamaSvc.getStatus()`:
  - not ready → broadcast raw `transcription:data` (current fallback).
  - ready → broadcast a placeholder `transcription:data` (flag indicating a correction
    stream will follow, no display text), then enqueue the streaming correction.
- Maintain a module-level **`currentGenerationId`** incremented whenever a recording
  session starts/stops. Each correction is tagged with the generationId captured at
  enqueue time. Tokens/results for a stale generation are dropped before emit.
- Hold the active `AbortController`(s) so `correction:cancel` can abort in-flight reads
  and flush the pending queue for the cancelled generation.
- On `correction:done`: `updateTranscriptEnhancement(transcriptId, { enhancedText, status:'completed' })` (no metadata blob).
- On cancel: leave raw text, set `enhancement_status='cancelled'`.
- **Remove** the `IntentionProcessor` call and the `keywords` field from the broadcast.

#### 3. Prompts — `src/main/localLLMPrompts.ts`

- Replace the 3-task enhancement prompt (correct / intention / keywords) with a
  **correction-only** prompt that instructs the model to output **only** the corrected
  transcription text, no JSON, no commentary. Keep the per-language (en / zh-TW)
  variants and the Traditional-Chinese enforcement (`s2twConverter` still applied to the
  final streamed text).
- Remove `getEnhancementJsonSchema`.

#### 4. IPC bridge — `src/preload/index.ts`

- Add to `on` validChannels: `correction:start`, `correction:token`,
  `correction:done`, `correction:error`, `correction:cancelled`.
- Add to `send` validChannels: `correction:cancel`.
- Surface the matching methods on `ElectronAPI`
  (`src/renderer/src/types/index.ts`).

#### 5. Renderer — streaming display

- New reusable `src/renderer/src/components/StreamingText.tsx`:
  - Subscribes to `correction:*` for a given `transcriptId` (+ current generationId).
  - Buffers incoming chunks in a `ref`, flushes to React state on
    `requestAnimationFrame` → **backpressure-safe** if tokens outrun renders.
  - Renders a blinking cursor / typing affordance while the stream is open; settles to
    plain final text on `done`. Generic enough to reuse for any future streamed output.
- `useAIInteraction.ts` / transcription rendering:
  - A transcription bubble in the "correction pending" state renders `<StreamingText>`.
  - In Ollama-unavailable fallback, renders the raw text directly (plain).
  - Fire `correction:cancel` (with current generationId) when the user stops recording
    or starts a new recording.
- **Remove**: `KeywordHighlighter.tsx` (delete), the keyword-span logic in
  `MarkdownRenderer.tsx`, and `keywords` plumbing through `transcription:data` and
  `useAIInteraction`. (Keep `MarkdownRenderer` itself if it is still used for AI chat
  answers elsewhere — scope the removal to the keyword feature only.)

#### 6. Persistence — `src/main/databaseService.ts`

- Reuse `updateTranscriptEnhancement` for the `done` path (enhanced_text + content,
  status='completed'); the `enhancement_metadata` blob becomes empty/unused.
- Allow `enhancement_status='cancelled'` as a valid value for the cancel path (add a
  lightweight status-update method if `updateTranscriptEnhancement` doesn't fit).

## Edge Cases

| Case | Handling |
|------|----------|
| Ollama stalls mid-stream | Per-token inactivity timeout → abort → raw fallback, status `cancelled` |
| Connection drop | Stream read throws → `correction:error`; raw stays, status `cancelled` |
| Very long transcript | Bounded per segment (existing `num_predict` cap) |
| Cancel / restart race | `generationId` guard: stale tokens dropped at emit (main) and ignored (renderer); pending queue flushed on cancel |
| UI render lags token rate | `requestAnimationFrame`-batched buffer in `StreamingText` |
| Cancel mid-stream | Abort closes the HTTP read (no leaked connection); partial discarded |

## Acceptance Criteria

- [ ] Keyword highlighting removed (component deleted, plumbing gone, prompts updated).
- [ ] Correction renders incrementally as tokens arrive.
- [ ] Mid-stream cancel (stop / new recording) aborts the stream with no leaked connection.
- [ ] Final corrected text persisted to session history on completion.

## Touch-Points

- `src/main/ollamaService.ts` — streaming method, remove structured path
- `src/main/index.ts` — `transcription:data` handler, generationId, cancel handling
- `src/main/localLLMPrompts.ts` — correction-only prompt, remove schema
- `src/main/databaseService.ts` — done/cancelled persistence
- `src/preload/index.ts` — `correction:*` channels
- `src/renderer/src/types/index.ts` — ElectronAPI methods
- `src/renderer/src/components/StreamingText.tsx` — new
- `src/renderer/src/components/KeywordHighlighter.tsx` — deleted
- `src/renderer/src/components/MarkdownRenderer.tsx` — remove keyword spans
- `src/renderer/src/hooks/useAIInteraction.ts` — wire streaming, cancel, drop keywords
