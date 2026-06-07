# Raw Transcription + Streaming Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blocking, structured-JSON Ollama "enhancement" + keyword-highlight UI with per-segment, IPC-streamed, plain-text correction that renders token-by-token in a reusable streaming panel.

**Architecture:** Whisper segments still arrive at the main-process `transcription:data` handler. When Ollama is ready the raw text is no longer broadcast for display; instead a streaming placeholder is broadcast and the main process streams Ollama's plain-text correction chunk-by-chunk over new `correction:*` IPC channels. The renderer appends chunks (rAF-batched) into the existing transcription message. A monotonic `generationId` plus per-segment `AbortController`s make stop/restart cancellation leak-free. When Ollama is unavailable the old raw-text fallback is used.

**Tech Stack:** Electron (main/preload/renderer IPC), TypeScript, React 19, Tailwind + shadcn/ui, Ollama HTTP (`/api/chat` with `stream:true`, NDJSON), Vitest (node env, no new deps).

---

## Spec Deviations (read first)

These are deliberate refinements of `docs/superpowers/specs/2026-06-07-raw-transcription-streaming-correction-design.md`, confirmed against the actual code:

1. **`MarkdownRenderer.tsx` is NOT modified.** Its inline-code→clickable-keyword span is used by the AI **summary** and **ActionsPanel**, not by transcription. Only the transcription `KeywordHighlighter` is removed. "Keyword highlighting removed" = transcription keyword highlighting removed.
2. **Token-stream subscription lives in `useAIInteraction` (the hook), not inside `StreamingText`.** The hook already owns the `transcriptions` array (needed for persistence-on-load and AI context). `StreamingText` is a presentational component (text + blinking cursor). The reusable streamed-output primitive is the hook pattern + `StreamingText` together. rAF batching (backpressure) lives in the hook's token handler.
3. **Auto-trigger infra is left dormant, not ripped out.** We sever the *feed* (`intentionProcessor.processEnhancedSegment` call at `index.ts:1403`). The auto-trigger settings/IPC/UI plumbing stays (out of scope), but nothing feeds it, so it never fires.
4. **No DB schema change.** Reuse `updateTranscriptEnhancement` with empty metadata for the done path; add `'cancelled'` to status type unions for the cancel path.

---

## File Structure

**Create:**
- `src/main/ndjsonStream.ts` — pure async NDJSON parser for a `ReadableStream` (testable, no Ollama).
- `tests/ndjsonStream.test.ts` — unit tests for the parser.
- `tests/localLLMPrompts.test.ts` — unit tests for the correction prompt.
- `src/renderer/src/components/StreamingText.tsx` — presentational streaming text + cursor.

**Modify:**
- `src/main/localLLMPrompts.ts` — add `getCorrectionPrompt`; remove `getEnhancementPrompt` + `getEnhancementJsonSchema`.
- `src/main/ollamaService.ts` — add `enhanceStream`; remove `enhance`/`runInference`/`enhanceSingleSegment`/`retryInference` and the structured queue item.
- `src/main/transcriptionEnhancementService.ts` — remove dead `TranscriptionEnhancementService` class + `EnhanceResponse`; keep `TranscriptionSegment`, `SessionContext`, `EnhancedSegment` types.
- `src/main/whisperBackend.ts` — remove dead enhancement-service wiring.
- `src/main/databaseService.ts` — add `'cancelled'` to two status unions.
- `src/main/index.ts` — `generationId` + active-corrections map, streaming orchestration in `transcription:data`, `correction:cancel` handler, generation bump on session start/end, remove intention feed + keywords from broadcast.
- `src/preload/index.ts` — whitelist `correction:*` channels.
- `src/renderer/src/hooks/useAIInteraction.ts` — `correction:*` handling (rAF-batched), `isStreaming` flag, fire `correction:cancel`, drop `keywords`.
- `src/renderer/src/components/ChatPanel.tsx` — render `StreamingText`, remove `KeywordHighlighter`.

**Delete:**
- `src/renderer/src/components/KeywordHighlighter.tsx`

---

## Task 1: NDJSON stream parser (pure, TDD)

Ollama `/api/chat` with `stream:true` returns newline-delimited JSON, one object per line: `{"message":{"content":"..."},"done":false}` … final `{"done":true}`. Lines can split across network chunks. This parser is the testable seam.

**Files:**
- Create: `src/main/ndjsonStream.ts`
- Test: `tests/ndjsonStream.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ndjsonStream.test.ts
import { describe, it, expect } from 'vitest'
import { parseNdjsonStream } from '../src/main/ndjsonStream'

// Build a ReadableStream<Uint8Array> from arbitrary string chunks.
function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]))
      } else {
        controller.close()
      }
    }
  })
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<any[]> {
  const out: any[] = []
  for await (const obj of parseNdjsonStream(stream)) out.push(obj)
  return out
}

describe('parseNdjsonStream', () => {
  it('parses one object per line', async () => {
    const objs = await collect(
      streamFrom(['{"message":{"content":"He"}}\n', '{"message":{"content":"llo"}}\n'])
    )
    expect(objs.map((o) => o.message.content)).toEqual(['He', 'llo'])
  })

  it('reassembles a line split across chunks', async () => {
    const objs = await collect(streamFrom(['{"message":{"con', 'tent":"hi"}}\n']))
    expect(objs[0].message.content).toBe('hi')
  })

  it('emits a trailing line with no final newline', async () => {
    const objs = await collect(streamFrom(['{"done":true}']))
    expect(objs[0].done).toBe(true)
  })

  it('skips blank and malformed lines', async () => {
    const objs = await collect(streamFrom(['\n', 'not json\n', '{"done":true}\n']))
    expect(objs).toHaveLength(1)
    expect(objs[0].done).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/ndjsonStream.test.ts`
Expected: FAIL — cannot find module `../src/main/ndjsonStream`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/main/ndjsonStream.ts
/**
 * Parse a ReadableStream of UTF-8 bytes as newline-delimited JSON.
 * Yields one parsed object per complete line. Reassembles lines split
 * across chunks, emits a trailing newline-less line, and skips blank or
 * malformed lines (does not throw on bad JSON).
 */
export async function* parseNdjsonStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<any, void, unknown> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let newlineIndex: number
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)
        if (!line) continue
        try {
          yield JSON.parse(line)
        } catch {
          // skip malformed line
        }
      }
    }

    const tail = buffer.trim()
    if (tail) {
      try {
        yield JSON.parse(tail)
      } catch {
        // skip malformed trailing line
      }
    }
  } finally {
    reader.releaseLock()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/ndjsonStream.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/ndjsonStream.ts tests/ndjsonStream.test.ts
git commit -m "Feat: Add NDJSON stream parser for Ollama streaming"
```

---

## Task 2: Correction-only prompt (TDD)

Replace the 3-task (correct/intention/keywords) JSON prompt with a correction-only, plain-text prompt. Keep en + zh-TW variants and Traditional-Chinese enforcement intent.

**Files:**
- Modify: `src/main/localLLMPrompts.ts:6-114`
- Test: `tests/localLLMPrompts.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/localLLMPrompts.test.ts
import { describe, it, expect } from 'vitest'
import { getCorrectionPrompt } from '../src/main/localLLMPrompts'

describe('getCorrectionPrompt', () => {
  it('embeds the raw text and asks for plain output (en)', () => {
    const p = getCorrectionPrompt({ rawText: 'helo wrld', conversationHistory: [], userLanguage: 'en' })
    expect(p.user).toContain('helo wrld')
    expect(p.system.toLowerCase()).not.toContain('json')
    expect(p.user.toLowerCase()).not.toContain('json')
  })

  it('uses Traditional Chinese instructions for zh-TW', () => {
    const p = getCorrectionPrompt({ rawText: '你好', conversationHistory: [], userLanguage: 'zh-TW' })
    expect(p.system).toContain('繁體中文')
    expect(p.user).toContain('你好')
  })

  it('includes recent context when provided', () => {
    const p = getCorrectionPrompt({
      rawText: 'next line',
      conversationHistory: ['prior sentence'],
      userLanguage: 'en'
    })
    expect(p.user).toContain('prior sentence')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/localLLMPrompts.test.ts`
Expected: FAIL — `getCorrectionPrompt` is not exported.

- [ ] **Step 3: Implement `getCorrectionPrompt` and remove the old enhancement prompt**

In `src/main/localLLMPrompts.ts`, replace the `enhancementPrompts` object, `getEnhancementPrompt`, and `getEnhancementJsonSchema` (lines 17-114) with:

```typescript
const correctionPrompts: Record<string, (params: PromptParams) => PromptResult> = {
  en: ({ rawText, conversationHistory }) => ({
    system:
      'You are a speech-to-text correction assistant. Output ONLY the corrected transcription text — no labels, no quotes, no explanations, no commentary.',
    user: `Correct this speech-to-text transcription. Fix homophones, mishearings, grammar, and punctuation. Preserve the original meaning and language. Output only the corrected text.

${conversationHistory.length > 0 ? `Recent context:\n${conversationHistory.join('\n')}\n\n` : ''}Transcription: ${rawText}`
  }),

  'zh-TW': ({ rawText, conversationHistory }) => ({
    system:
      '你是語音轉文字修正助理。所有輸出必須使用繁體中文（台灣正體）。只輸出修正後的逐字稿文字，不要標籤、不要引號、不要說明、不要附加任何評論。',
    user: `修正以下語音轉文字逐字稿。修正同音字、誤聽、語法與標點，保留原意。若包含簡體中文，請轉換為繁體中文。只輸出修正後的文字。

${conversationHistory.length > 0 ? `最近對話：\n${conversationHistory.join('\n')}\n\n` : ''}逐字稿：${rawText}`
  })
}

export function getCorrectionPrompt(params: PromptParams): PromptResult {
  const lang = params.userLanguage === 'zh-TW' ? 'zh-TW' : 'en'
  return correctionPrompts[lang](params)
}
```

Leave the `PromptParams`/`PromptResult` interfaces (lines 6-15) and all `// ─── AI Action Prompt Types ───` code below unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/localLLMPrompts.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/localLLMPrompts.ts tests/localLLMPrompts.test.ts
git commit -m "Feat: Add correction-only plain-text prompt, remove enhancement JSON prompt"
```

---

## Task 3: `ollamaService.enhanceStream` + remove structured path

Add a streaming correction method that uses the Task 1 parser; remove the structured-JSON `enhance` path. No automated test (requires a live Ollama); verified via Task 9 manual run. Keep it thin and reuse the tested parser.

**Files:**
- Modify: `src/main/ollamaService.ts:1-310` (imports, queue types, queue processor) and `:259-530` (remove methods)

- [ ] **Step 1: Update imports (`src/main/ollamaService.ts:1-8`)**

```typescript
import { EventEmitter } from 'events'
import type { TranscriptionSegment, SessionContext } from './transcriptionEnhancementService'
import { getCorrectionPrompt } from './localLLMPrompts'
import { parseNdjsonStream } from './ndjsonStream'
```

(Removes `EnhancedSegment`, `EnhanceResponse`, `getEnhancementPrompt`, `getEnhancementJsonSchema`.)

- [ ] **Step 2: Replace the queue item type (`src/main/ollamaService.ts:44-56`)**

```typescript
export interface EnhanceStreamOptions {
  onToken: (chunk: string) => void
  signal: AbortSignal
}

type QueueItem =
  | {
      type: 'enhanceStream'
      resolve: (value: string) => void
      reject: (error: Error) => void
      request: {
        segment: TranscriptionSegment
        sessionContext: SessionContext
        options: EnhanceStreamOptions
      }
    }
  | {
      type: 'chat'
      resolve: (value: ChatResponse) => void
      reject: (error: Error) => void
      request: ChatParams
    }
```

- [ ] **Step 3: Replace the public `enhance` method (`src/main/ollamaService.ts:251-272`) with `enhanceStream`**

```typescript
  /**
   * Stream a plain-text correction for one segment.
   * Queued sequentially like chat(). Resolves with the full corrected text.
   * onToken fires for each streamed chunk. Honors options.signal (cancel) and an
   * internal inactivity timeout that resets on every token (detects stalls).
   */
  async enhanceStream(
    segment: TranscriptionSegment,
    sessionContext: SessionContext,
    options: EnhanceStreamOptions
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.inferenceQueue.push({
        type: 'enhanceStream',
        resolve,
        reject,
        request: { segment, sessionContext, options }
      })
      this.processQueue()
    })
  }
```

- [ ] **Step 4: Update `processQueue` (`src/main/ollamaService.ts:291-311`) dispatch**

Replace the `if (item.type === 'enhance')` branch:

```typescript
        if (item.type === 'enhanceStream') {
          const result = await this.runStreamingCorrection(
            item.request.segment,
            item.request.sessionContext,
            item.request.options
          )
          item.resolve(result)
        } else {
          const result = await this.runChat(item.request)
          item.resolve(result)
        }
```

- [ ] **Step 5: Replace `runInference`/`enhanceSingleSegment`/`retryInference` (`src/main/ollamaService.ts:376-560`) with `runStreamingCorrection`**

Delete those three methods entirely and add:

```typescript
  private async runStreamingCorrection(
    segment: TranscriptionSegment,
    sessionContext: SessionContext,
    options: EnhanceStreamOptions
  ): Promise<string> {
    if (this.status !== 'ready') {
      throw new Error(`Ollama not ready (status: ${this.status})`)
    }
    // Already cancelled before our turn in the queue: stop immediately.
    if (options.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const prompt = getCorrectionPrompt({
      rawText: segment.rawText,
      conversationHistory: sessionContext.conversationHistory.slice(-3),
      userLanguage: sessionContext.userLanguage
    })

    // Inactivity timeout: abort if no token arrives within INFERENCE_TIMEOUT_MS.
    const controller = new AbortController()
    const onExternalAbort = () => controller.abort()
    options.signal.addEventListener('abort', onExternalAbort)
    let inactivity = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS)

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.activeModel,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          stream: true,
          options: { temperature: 0.1, num_predict: 512 }
        }),
        signal: controller.signal
      })

      if (!response.ok || !response.body) {
        throw new Error(`Ollama stream failed: ${response.status}`)
      }

      let full = ''
      for await (const obj of parseNdjsonStream(response.body)) {
        clearTimeout(inactivity)
        inactivity = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS)
        const chunk: string = obj?.message?.content ?? ''
        if (chunk) {
          full += chunk
          options.onToken(chunk)
        }
        if (obj?.done) break
      }
      return full
    } finally {
      clearTimeout(inactivity)
      options.signal.removeEventListener('abort', onExternalAbort)
    }
  }
```

- [ ] **Step 6: Verify the rest of the file still references only existing symbols**

Run: `pnpm exec tsc --noEmit -p tsconfig.node.json 2>&1 | grep -i ollamaService` (best-effort; the repo has pre-existing TS errors — only fix ones in files you touched). Confirm no errors mention removed names (`enhance`, `runInference`, `EnhanceResponse`).
Expected: no `ollamaService.ts` errors about removed symbols.

- [ ] **Step 7: Commit**

```bash
git add src/main/ollamaService.ts
git commit -m "Feat: Add streaming plain-text correction, remove structured enhance path"
```

---

## Task 4: Remove dead enhancement-service code

`TranscriptionEnhancementService` and its `whisperBackend` wiring have no live callers (`setupEnhancementService`/`getEnhancementService`/`triggerTranscriptionEnhancement` are never called). Remove cleanly (no shims, per project rules). Keep the shared types.

**Files:**
- Modify: `src/main/transcriptionEnhancementService.ts`
- Modify: `src/main/whisperBackend.ts:7-8,79,131-189`

- [ ] **Step 1: Trim `transcriptionEnhancementService.ts` to types only**

Replace the entire file with the type definitions still consumed elsewhere (`TranscriptionSegment`, `SessionContext` by `ollamaService`/`whisperBackend`; `EnhancedSegment` by `intentionProcessor`):

```typescript
// Shared transcription/enhancement types.

export interface TranscriptionSegment {
  id: string
  rawText: string
  timestamp: number
  sourceType: 'microphone' | 'system'
}

export interface SessionContext {
  sessionId: string
  conversationHistory: string[]
  userLanguage: string
}

export interface EnhancedSegment {
  id: string
  corrected: string
  translation?: string
  intention: {
    primary: 'question' | 'command' | 'statement' | 'schedule' | 'reminder' | 'concern' | 'request'
    confidence: number
    suggestedActions?: string[]
  }
  keywords?: string[]
  confidence: number
}
```

(Removes the `EnhanceResponse` interface, the `TranscriptionEnhancementService` class, the singleton, and `getTranscriptionEnhancementService`.)

- [ ] **Step 2: Remove dead wiring from `whisperBackend.ts`**

- Remove the import lines `src/main/whisperBackend.ts:7-8` (`getTranscriptionEnhancementService`, `TranscriptionEnhancementService`). Keep any `TranscriptionSegment` import only if still referenced after the next edit; otherwise remove it too.
- Remove the field `private enhancementService ... = null` (`:79`).
- Remove the methods `setupEnhancementService` (`:131-138`), `getEnhancementService` (`:140-145`), and `triggerTranscriptionEnhancement` (`:147-189`).

- [ ] **Step 3: Confirm no remaining references**

Run:
```bash
grep -rn "getTranscriptionEnhancementService\|TranscriptionEnhancementService\|enhanceSegment\|triggerTranscriptionEnhancement\|setupEnhancementService\|getEnhancementService\|EnhanceResponse" src
```
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add src/main/transcriptionEnhancementService.ts src/main/whisperBackend.ts
git commit -m "Refactor: Remove dead TranscriptionEnhancementService wiring"
```

---

## Task 5: Allow `'cancelled'` enhancement status (DB)

**Files:**
- Modify: `src/main/databaseService.ts:168,282`

- [ ] **Step 1: Widen the two status unions**

`src/main/databaseService.ts:168` (in `EnhancedTranscriptData`):
```typescript
  enhancementStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
```

`src/main/databaseService.ts:282` (param of `updateTranscriptEnhancementStatus`):
```typescript
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
```

- [ ] **Step 2: Commit**

```bash
git add src/main/databaseService.ts
git commit -m "Feat: Allow 'cancelled' enhancement status"
```

---

## Task 6: Preload — whitelist `correction:*` channels

The renderer uses the generic `electronAPI.on(channel, …)` / `.send(channel, …)`; only the channel whitelists need updating.

**Files:**
- Modify: `src/preload/index.ts:138-195` (on), `:205-234` (send)

- [ ] **Step 1: Add receive channels**

In the `on` `validChannels` array (after `'transcription:data',` at line 149), add:
```typescript
      'correction:start',
      'correction:token',
      'correction:done',
      'correction:error',
      'correction:cancelled',
```

- [ ] **Step 2: Add the cancel send channel**

In the `send` `validChannels` array (after `'transcription:data',` at line 215), add:
```typescript
      'correction:cancel',
```

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "Feat: Whitelist correction:* IPC channels in preload"
```

---

## Task 7: Main — stream orchestration, generationId, cancel

Wire the streaming correction into the `transcription:data` handler, add generation-guarded cancellation, and remove the intention feed + keywords from the broadcast.

**Files:**
- Modify: `src/main/index.ts` — near top-level state, `startSession` (~285), `endCurrentSession` (~310), the `transcription:data` handler (1281-1460), and add a `correction:cancel` handler.

- [ ] **Step 1: Add module-level correction state**

Near the other top-level `let currentSessionId` declaration, add:

```typescript
// Streaming correction state
let currentGenerationId = 0
const activeCorrections = new Map<string, AbortController>()

function cancelAllCorrections(): void {
  currentGenerationId++ // invalidate in-flight + queued work for the old generation
  for (const controller of activeCorrections.values()) {
    controller.abort()
  }
  activeCorrections.clear()
}

function broadcastToWindows(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      try {
        win.webContents.send(channel, payload)
      } catch (e) {
        console.error(`[main/index.ts] broadcast ${channel} failed:`, e)
      }
    }
  }
}
```

- [ ] **Step 2: Bump generation on session start/end**

In `startSession` right after `currentSessionId = id` (`:285`), add:
```typescript
    cancelAllCorrections()
```
In `endCurrentSession` right after `currentSessionId = null` (`:310`), add:
```typescript
    cancelAllCorrections()
```

- [ ] **Step 3: Add the `correction:cancel` IPC handler**

Near the other `ipcMain.on` registrations (e.g. after the `app:graceful-stop-and-execute` handler ~`:1249`), add:
```typescript
  ipcMain.on('correction:cancel', () => {
    console.log('[main/index.ts] correction:cancel received')
    cancelAllCorrections()
  })
```

- [ ] **Step 4: Replace the enhancement+broadcast block in the `transcription:data` handler**

Replace lines `1349-1454` (the "2. Attempt real-time enhancement…" block through the broadcast loop) with raw-save-already-done logic that branches on Ollama readiness:

```typescript
        // 2. Branch: stream correction when Ollama is ready, else broadcast raw.
        const ollamaSvc = getOllamaService()
        const generationId = currentGenerationId

        if (ollamaSvc.getStatus() !== 'ready') {
          // Fallback: broadcast raw text (no correction available).
          broadcastToWindows('transcription:data', {
            id: transcriptId,
            session_id: currentSessionId,
            timestamp,
            content: transcriptionData.text,
            sourceType: transcriptionData.sourceType,
            role: 'assistant',
            type: 'transcription',
            isStreaming: false
          })
          event.sender.send('transcription:processed', { transcriptId })
          return
        }

        // Ollama ready: broadcast an empty streaming placeholder (no raw shown),
        // then stream the correction into it.
        broadcastToWindows('transcription:data', {
          id: transcriptId,
          session_id: currentSessionId,
          timestamp,
          content: '',
          sourceType: transcriptionData.sourceType,
          role: 'assistant',
          type: 'transcription',
          isStreaming: true
        })
        broadcastToWindows('correction:start', { transcriptId, generationId })

        const settings = await loadSettings()
        const userLanguage = settings.language
        const controller = new AbortController()
        activeCorrections.set(transcriptId, controller)

        try {
          let full = await ollamaSvc.enhanceStream(
            { id: transcriptId, rawText: transcriptionData.text, timestamp: Date.now(), sourceType: transcriptionData.sourceType },
            { sessionId: currentSessionId, conversationHistory: [], userLanguage },
            {
              signal: controller.signal,
              onToken: (chunk) => {
                if (generationId !== currentGenerationId) return
                broadcastToWindows('correction:token', { transcriptId, generationId, chunk })
              }
            }
          )

          if (generationId !== currentGenerationId) {
            return // a newer generation took over mid-stream; drop result
          }

          if (userLanguage === 'zh-TW' && full) {
            full = s2twConverter(full)
          }

          broadcastToWindows('correction:done', { transcriptId, generationId, fullText: full })
          await dbService.updateTranscriptEnhancement(transcriptId, {
            enhancedText: full,
            enhancementMetadata: {}
          })
        } catch (err) {
          const aborted = err instanceof Error && err.name === 'AbortError'
          console.warn(
            `[main/index.ts] Correction ${aborted ? 'cancelled' : 'error'} for ${transcriptId}:`,
            err
          )
          broadcastToWindows(aborted ? 'correction:cancelled' : 'correction:error', {
            transcriptId,
            generationId
          })
          // Keep raw text; mark uncorrected.
          await dbService
            .updateTranscriptEnhancementStatus(transcriptId, 'cancelled')
            .catch(() => {})
        } finally {
          activeCorrections.delete(transcriptId)
        }

        event.sender.send('transcription:processed', { transcriptId })
```

Notes:
- The `try { const transcriptId = randomUUID() … addEnhancedTranscript … }` raw-save block (`1312-1347`) is unchanged and still runs first.
- Remove the now-deleted `getIntentionProcessor`/`processEnhancedSegment` usage — it lived inside the replaced block, so it is gone. Leave the `getIntentionProcessor` import and its other uses (auto-trigger settings) intact.
- `s2twConverter`, `loadSettings`, `dbService`, `getOllamaService`, `BrowserWindow` are already imported/in scope in this file.

- [ ] **Step 5: Verify the handler compiles and references resolve**

Run: `pnpm exec tsc --noEmit -p tsconfig.node.json 2>&1 | grep -i "index.ts"`
Expected: no new errors referencing `enhance`, `processEnhancedSegment` (in the removed block), `EnhanceResponse`, or `enhancedData`/`displayContent` (removed locals). Pre-existing unrelated errors may remain.

- [ ] **Step 6: Commit**

```bash
git add src/main/index.ts
git commit -m "Feat: Stream per-segment correction over IPC with generation-guarded cancel"
```

---

## Task 8: Renderer — StreamingText, hook wiring, ChatPanel, delete KeywordHighlighter

**Files:**
- Create: `src/renderer/src/components/StreamingText.tsx`
- Modify: `src/renderer/src/hooks/useAIInteraction.ts:21-26,79-102`
- Modify: `src/renderer/src/components/ChatPanel.tsx:2-3,148-174`
- Delete: `src/renderer/src/components/KeywordHighlighter.tsx`

- [ ] **Step 1: Create `StreamingText` (presentational)**

```tsx
// src/renderer/src/components/StreamingText.tsx
import React, { memo } from 'react'

interface StreamingTextProps {
  text: string
  isStreaming?: boolean
}

/**
 * Presentational streamed-text view: renders text and, while streaming, a
 * blinking cursor. Reusable for any token-streamed output. The token
 * subscription and buffering live in the owning hook, not here.
 */
const NonMemoizedStreamingText: React.FC<StreamingTextProps> = ({ text, isStreaming }) => {
  return (
    <span>
      {text}
      {isStreaming && (
        <span className="ml-0.5 inline-block w-1.5 h-4 align-text-bottom bg-current animate-pulse" />
      )}
    </span>
  )
}

export const StreamingText = memo(
  NonMemoizedStreamingText,
  (prev, next) => prev.text === next.text && prev.isStreaming === next.isStreaming
)

StreamingText.displayName = 'StreamingText'
```

- [ ] **Step 2: Update the `TranscriptionMessage` type (`useAIInteraction.ts:21-26`)**

```typescript
interface TranscriptionMessage extends AIMessage {
  timestamp: number
  type: 'transcription'
  sourceType?: 'microphone' | 'system'
  isStreaming?: boolean
}
```

(Removes the `keywords?: string[]` field.)

- [ ] **Step 3: Replace the `transcription:data` subscription effect (`useAIInteraction.ts:79-102`) with streaming-aware handling**

```typescript
  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) return () => {}

    // rAF-batched token buffers, keyed by transcriptId (backpressure safety).
    const buffers = new Map<string, string>()
    let rafId: number | null = null

    const flush = () => {
      rafId = null
      if (buffers.size === 0) return
      setTranscriptions((prev) =>
        prev.map((m) => {
          const pending = buffers.get(m.id)
          return pending ? { ...m, content: m.content + pending } : m
        })
      )
      buffers.clear()
    }
    const scheduleFlush = () => {
      if (rafId == null) rafId = requestAnimationFrame(flush)
    }

    const unsubData = api.on('transcription:data', (t: TranscriptionMessage & { isStreaming?: boolean }) => {
      if (!t) return
      // Allow empty content only for the streaming placeholder.
      if (!t.content && !t.isStreaming) return
      const formatted: TranscriptionMessage = {
        ...t,
        content: t.content || '',
        timestamp: new Date(t.timestamp as any).getTime(),
        sourceType: t.sourceType || 'system',
        isStreaming: !!t.isStreaming
      }
      setTranscriptions((prev) => [...prev, formatted])
    })

    const unsubToken = api.on(
      'correction:token',
      ({ transcriptId, chunk }: { transcriptId: string; chunk: string }) => {
        buffers.set(transcriptId, (buffers.get(transcriptId) || '') + chunk)
        scheduleFlush()
      }
    )

    const settle = (transcriptId: string, fullText?: string) => {
      if (rafId != null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      buffers.delete(transcriptId)
      setTranscriptions((prev) =>
        prev.map((m) =>
          m.id === transcriptId
            ? { ...m, content: fullText != null ? fullText : m.content, isStreaming: false }
            : m
        )
      )
    }

    const unsubDone = api.on('correction:done', ({ transcriptId, fullText }: { transcriptId: string; fullText: string }) =>
      settle(transcriptId, fullText)
    )
    const unsubCancelled = api.on('correction:cancelled', ({ transcriptId }: { transcriptId: string }) =>
      settle(transcriptId)
    )
    const unsubError = api.on('correction:error', ({ transcriptId }: { transcriptId: string }) =>
      settle(transcriptId)
    )

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
      unsubData()
      unsubToken()
      unsubDone()
      unsubCancelled()
      unsubError()
    }
  }, [])
```

- [ ] **Step 4: Drop keywords from initial-load mapping (`useAIInteraction.ts:116-125`)**

Remove the `keywords: t.enhancement_metadata_parsed?.keywords || []` line from the `formattedTranscripts` object (leave the other fields).

- [ ] **Step 5: Expose a cancel helper from the hook (return object, `useAIInteraction.ts:417-434`)**

Add inside the hook body (before the `return`):
```typescript
  const cancelCorrections = useCallback(() => {
    ;(window as any).electronAPI?.send('correction:cancel')
  }, [])
```
And add `cancelCorrections` to the returned object.

> Wiring note: the authoritative cancel already happens in main on `session:start`/`session:end` (Task 7 Step 2). `cancelCorrections` is for any explicit renderer-driven stop/restart that is not a session boundary. If recording start/stop in `MainController`/`RealTimeAnalysis` does not already go through `session:start`/`session:end`, call `cancelCorrections()` there on stop. No further change is required for the acceptance criterion because session boundaries cover stop/new-recording.

- [ ] **Step 6: Update `ChatPanel.tsx` to render `StreamingText`**

Replace the import at `:3`:
```tsx
import { StreamingText } from '@/components/StreamingText'
```
(Remove `import { KeywordHighlighter } from '@/components/KeywordHighlighter'`.)

Replace the transcription render at `:161-165`:
```tsx
                        <StreamingText text={m.content} isStreaming={m.isStreaming} />
```
Leave the `<Markdown onKeywordClick={handleKeywordClick}>{summary}</Markdown>` for summary (`:196`) and `handleKeywordClick` unchanged.

- [ ] **Step 7: Delete `KeywordHighlighter.tsx`**

```bash
git rm src/renderer/src/components/KeywordHighlighter.tsx
```

- [ ] **Step 8: Verify no dangling references**

Run:
```bash
grep -rn "KeywordHighlighter\|m.keywords\|\.keywords" src/renderer/src/components/ChatPanel.tsx src/renderer/src/hooks/useAIInteraction.ts
```
Expected: no matches.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/components/StreamingText.tsx src/renderer/src/components/ChatPanel.tsx src/renderer/src/hooks/useAIInteraction.ts
git commit -m "Feat: Render streaming correction, remove transcription keyword highlighting"
```

---

## Task 9: Manual end-to-end verification

No automated E2E exists; verify against a running Ollama (`gemma3:4b`) per the acceptance criteria.

- [ ] **Step 1: Run unit tests**

Run: `pnpm test:run`
Expected: existing `release-config` tests plus the new `ndjsonStream` and `localLLMPrompts` tests pass.

- [ ] **Step 2: Launch the app (only with user approval — `pnpm dev`)**

Per project rules, do not run `pnpm dev` unless the user asks. When approved:
- Start a recording; speak. Confirm the transcription bubble appears **already streaming** (no raw-text flash) and corrected text **flows in token-by-token** with a blinking cursor, settling on completion.
- Confirm **no keyword highlighting** anywhere in the transcription tab.
- Mid-stream, **stop** (and separately, **start a new recording**); confirm the in-flight correction halts immediately, the bubble keeps its raw/partial-free state, and no console errors about leaked streams.
- Stop Ollama (or use a state where status≠ready) and record; confirm **raw text** is shown as fallback.
- Reopen the session from history; confirm the **final corrected text persisted** (loads from `enhanced_text`).

- [ ] **Step 3: Acceptance checklist**

- [ ] Keyword highlighting removed (component deleted, plumbing gone, prompt updated).
- [ ] Correction renders incrementally as tokens arrive.
- [ ] Mid-stream cancel (stop / new recording) aborts the stream with no leaked connection.
- [ ] Final corrected text persisted to session history on completion.

---

## Self-Review Notes

- **Spec coverage:** transport (IPC — Tasks 6/7/8), per-segment trigger (Task 7), plain-text streaming output (Tasks 2/3), shadcn display (Task 8), cancel→keep-raw/`cancelled` (Tasks 5/7/8), intention drop (Tasks 3/4/7), keyword removal (Tasks 2/8), persistence (Task 7 done-path) — all mapped.
- **Type consistency:** `enhanceStream(segment, sessionContext, {onToken, signal})` defined in Task 3 and called identically in Task 7. `correction:token` payload `{transcriptId, generationId, chunk}` emitted in Task 7, consumed by `{transcriptId, chunk}` in Task 8 (extra field ignored — fine). `isStreaming` flag defined in Task 8 Step 2, set by Task 7 broadcasts, read in ChatPanel.
- **Deviations** from spec are listed at the top and are intentional.
