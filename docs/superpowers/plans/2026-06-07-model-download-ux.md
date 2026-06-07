# Model Download UX & Recording Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Ollama models an explicit download lifecycle (idle→downloading→verifying→ready→error) and gate the record action on a ready model, while letting users deliberately record raw without the LLM.

**Architecture:** The main process (`ollamaService`) owns a single `ModelState` and broadcasts it on `ollama:model-state`. The renderer reads it via a `useOllamaModelState` hook. A pure `decideRecordAction()` function maps `{aiCorrection, phase, reachable}` to a record action; `MainController` consults it before starting a recording and shows a gate dialog when blocked. `OllamaSettings` unifies model selection with downloading. Pure logic (gate decision, Ollama error classification, pull-status mapping) is extracted into dependency-free modules and unit-tested with Vitest.

**Tech Stack:** Electron (main/preload/renderer), React 19 + TypeScript, Tailwind + Radix UI (shadcn components already present: `dialog`, `alert`, `progress`, `switch`, `select`, `badge`, `button`), Vitest (node environment, no jsdom — keep tested logic pure).

---

## Conventions & shared contracts

These names are used across tasks — keep them identical.

**Lifecycle phase (string union, duplicated intentionally in main + renderer — 5 literals, no shared module wired for both processes):**
```ts
type ModelPhase = 'idle' | 'downloading' | 'verifying' | 'ready' | 'error'
```

**Model-state broadcast payload (`ollama:model-state`):**
```ts
interface ModelState {
  phase: ModelPhase
  model: string                 // active model name
  progress: number              // 0..100
  reachable: boolean            // Ollama server reachable
  error: { kind: 'disk-full' | 'network' | 'generic'; raw: string } | null
  pendingModel: string | null   // finish-then-switch: chosen during active recording
}
```

**Settings key:** `aiCorrection: 'on' | 'off'` in `settings.json`, default `'on'`.

**IPC surface (final state after this plan):**
- invoke `ollama:get-model-state` → `ModelState`
- invoke `ollama:get-models` → `OllamaModel[]` (unchanged)
- invoke `ollama:select-model` (modelName) → `{ success: boolean }` (unified select+download+pending)
- invoke `ollama:cancel-pull` → `{ success: boolean }`
- invoke `ollama:delete-model` (modelName) → `{ success: boolean }` (unchanged)
- invoke `ollama:check-connection` → `{ reachable: boolean }`
- invoke `ollama:get-ai-correction` → `{ mode: 'on' | 'off' }`
- invoke `ollama:set-ai-correction` (mode) → `{ success: boolean }`
- event `ollama:model-state` → `ModelState`
- **Removed:** `ollama:get-status`, `ollama:set-model`, `ollama:pull-model`, event `ollama:status-changed`, event `ollama:pull-progress`.

---

## Task 1: Pure record-gate decision logic (TDD)

**Files:**
- Create: `src/renderer/src/lib/recordGate.ts`
- Test: `tests/record-gate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/record-gate.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { decideRecordAction } from '../src/renderer/src/lib/recordGate'

describe('decideRecordAction', () => {
  it('records raw immediately when aiCorrection is off, ignoring everything else', () => {
    expect(decideRecordAction({ aiCorrection: 'off', phase: 'idle', reachable: false }).type).toBe('start-raw')
    expect(decideRecordAction({ aiCorrection: 'off', phase: 'downloading', reachable: true }).type).toBe('start-raw')
  })

  it('prompts error when Ollama unreachable (aiCorrection on)', () => {
    expect(decideRecordAction({ aiCorrection: 'on', phase: 'ready', reachable: false }).type).toBe('prompt-error')
    expect(decideRecordAction({ aiCorrection: 'on', phase: 'idle', reachable: false }).type).toBe('prompt-error')
  })

  it('starts enhanced when reachable and ready', () => {
    expect(decideRecordAction({ aiCorrection: 'on', phase: 'ready', reachable: true }).type).toBe('start-enhanced')
  })

  it('prompts no-model when reachable but no model installed', () => {
    expect(decideRecordAction({ aiCorrection: 'on', phase: 'idle', reachable: true }).type).toBe('prompt-no-model')
  })

  it('prompts downloading while a pull is in flight', () => {
    expect(decideRecordAction({ aiCorrection: 'on', phase: 'downloading', reachable: true }).type).toBe('prompt-downloading')
    expect(decideRecordAction({ aiCorrection: 'on', phase: 'verifying', reachable: true }).type).toBe('prompt-downloading')
  })

  it('prompts error when phase is error', () => {
    expect(decideRecordAction({ aiCorrection: 'on', phase: 'error', reachable: true }).type).toBe('prompt-error')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tweizh/DEV/Intevia/Knovy-model-dl && pnpm vitest run tests/record-gate.test.ts`
Expected: FAIL — cannot find module `recordGate`.

- [ ] **Step 3: Write minimal implementation**

Create `src/renderer/src/lib/recordGate.ts`:
```ts
export type ModelPhase = 'idle' | 'downloading' | 'verifying' | 'ready' | 'error'
export type AiCorrectionMode = 'on' | 'off'

export interface RecordGateInput {
  aiCorrection: AiCorrectionMode
  phase: ModelPhase
  reachable: boolean
}

export type RecordAction =
  | { type: 'start-enhanced' }
  | { type: 'start-raw' }
  | { type: 'prompt-no-model' }
  | { type: 'prompt-downloading' }
  | { type: 'prompt-error' }

/**
 * Decide what should happen when the user attempts to start recording.
 * Pure: caller is responsible for refreshing `phase`/`reachable` first
 * (e.g. via ollama:get-model-state) so out-of-band model deletion is caught.
 */
export function decideRecordAction(input: RecordGateInput): RecordAction {
  if (input.aiCorrection === 'off') return { type: 'start-raw' }
  if (!input.reachable) return { type: 'prompt-error' }
  switch (input.phase) {
    case 'ready':
      return { type: 'start-enhanced' }
    case 'idle':
      return { type: 'prompt-no-model' }
    case 'downloading':
    case 'verifying':
      return { type: 'prompt-downloading' }
    case 'error':
    default:
      return { type: 'prompt-error' }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/tweizh/DEV/Intevia/Knovy-model-dl && pnpm vitest run tests/record-gate.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/tweizh/DEV/Intevia/Knovy-model-dl
git add src/renderer/src/lib/recordGate.ts tests/record-gate.test.ts
git commit -m "Feat: Add pure record-gate decision logic with tests"
```

---

## Task 2: Pure Ollama error/progress helpers (TDD)

**Files:**
- Create: `src/main/ollamaErrors.ts`
- Test: `tests/ollama-errors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/ollama-errors.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { classifyPullError, mapOllamaPullStatus } from '../src/main/ollamaErrors'

describe('classifyPullError', () => {
  it('detects disk-full conditions', () => {
    expect(classifyPullError('write /root/.ollama: no space left on device')).toBe('disk-full')
    expect(classifyPullError('ENOSPC: no space left')).toBe('disk-full')
  })

  it('detects network/offline conditions', () => {
    expect(classifyPullError('dial tcp: connection refused')).toBe('network')
    expect(classifyPullError('fetch failed')).toBe('network')
    expect(classifyPullError('request timeout')).toBe('network')
    expect(classifyPullError('unexpected EOF')).toBe('network')
  })

  it('falls back to generic', () => {
    expect(classifyPullError('manifest unknown')).toBe('generic')
    expect(classifyPullError('')).toBe('generic')
  })
})

describe('mapOllamaPullStatus', () => {
  it('maps verifying-family statuses', () => {
    expect(mapOllamaPullStatus('verifying sha256 digest')).toBe('verifying')
    expect(mapOllamaPullStatus('writing manifest')).toBe('verifying')
  })

  it('maps downloading-family statuses', () => {
    expect(mapOllamaPullStatus('pulling manifest')).toBe('downloading')
    expect(mapOllamaPullStatus('downloading abc123')).toBe('downloading')
  })

  it('returns null for statuses with no phase change', () => {
    expect(mapOllamaPullStatus('success')).toBeNull()
    expect(mapOllamaPullStatus('removing any unused layers')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tweizh/DEV/Intevia/Knovy-model-dl && pnpm vitest run tests/ollama-errors.test.ts`
Expected: FAIL — cannot find module `ollamaErrors`.

- [ ] **Step 3: Write minimal implementation**

Create `src/main/ollamaErrors.ts`:
```ts
export type PullErrorKind = 'disk-full' | 'network' | 'generic'

/** Classify an Ollama pull/connection error message into an actionable kind. */
export function classifyPullError(message: string): PullErrorKind {
  const m = (message || '').toLowerCase()
  if (m.includes('no space') || m.includes('enospc') || m.includes('disk full')) {
    return 'disk-full'
  }
  if (
    m.includes('connection refused') ||
    m.includes('dial tcp') ||
    m.includes('network') ||
    m.includes('timeout') ||
    m.includes('timed out') ||
    m.includes('eof') ||
    m.includes('fetch failed') ||
    m.includes('econnrefused') ||
    m.includes('enotfound')
  ) {
    return 'network'
  }
  return 'generic'
}

/**
 * Map an Ollama pull stream `status` line to a lifecycle phase.
 * Returns null when the status implies no phase change.
 */
export function mapOllamaPullStatus(status: string): 'downloading' | 'verifying' | null {
  const s = (status || '').toLowerCase()
  if (s.includes('verif') || s.includes('writing')) return 'verifying'
  if (s.includes('pulling') || s.includes('downloading')) return 'downloading'
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/tweizh/DEV/Intevia/Knovy-model-dl && pnpm vitest run tests/ollama-errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/tweizh/DEV/Intevia/Knovy-model-dl
git add src/main/ollamaErrors.ts tests/ollama-errors.test.ts
git commit -m "Feat: Add pure Ollama error/progress classifiers with tests"
```

---

## Task 3: Refactor `ollamaService` to own `ModelState` lifecycle

**Files:**
- Modify: `src/main/ollamaService.ts`

This replaces the `status: OllamaStatus` field with a single `ModelState` and wires lifecycle transitions, cancel/supersede, and pending-model support.

- [ ] **Step 1: Replace the status type, constants, and add imports**

Replace lines 10–28 region. Change the top of the file so that after the existing imports (line 8) you have:

```ts
import { classifyPullError, mapOllamaPullStatus, type PullErrorKind } from './ollamaErrors'

export type ModelPhase = 'idle' | 'downloading' | 'verifying' | 'ready' | 'error'

export interface ModelStateError {
  kind: PullErrorKind
  raw: string
}

export interface ModelState {
  phase: ModelPhase
  model: string
  progress: number
  reachable: boolean
  error: ModelStateError | null
  pendingModel: string | null
}

export interface OllamaModel {
  name: string
  size: number
  modifiedAt: string
  digest: string
}

export interface OllamaPullProgress {
  status: string
  digest?: string
  total?: number
  completed?: number
  percentage?: number
}

const OLLAMA_BASE_URL = 'http://localhost:11434'
const DEFAULT_MODEL = 'gemma4:e4b'
const INFERENCE_TIMEOUT_MS = 30000
const CHAT_TIMEOUT_MS = 60000
```

Delete the old `export type OllamaStatus = ...` line (old line 10) and the old `OllamaModel`/`OllamaPullProgress` interfaces and constants that this block now supersedes. (Keep `ChatParams`, `ChatResponse`, `QueueItem` exactly as they are.)

- [ ] **Step 2: Replace the class state fields and accessors**

Replace the field declarations + `getStatus`/`getActiveModel`/`setActiveModel`/`setStatus` (old lines 59–90) with:

```ts
  private modelState: ModelState = {
    phase: 'idle',
    model: DEFAULT_MODEL,
    progress: 0,
    reachable: false,
    error: null,
    pendingModel: null
  }
  private connectionCheckInterval: NodeJS.Timeout | null = null
  private currentPull: AbortController | null = null
  private inferenceQueue: QueueItem[] = []
  private isProcessingQueue = false

  constructor() {
    super()
    console.log('[OllamaService] Initialized')
  }

  getModelState(): ModelState {
    return { ...this.modelState }
  }

  getActiveModel(): string {
    return this.modelState.model
  }

  setActiveModel(model: string): void {
    this.setModelState({ model })
    console.log(`[OllamaService] Active model set to: ${model}`)
  }

  setPendingModel(model: string | null): void {
    this.setModelState({ pendingModel: model })
  }

  private setModelState(patch: Partial<ModelState>): void {
    const next = { ...this.modelState, ...patch }
    const changed = (Object.keys(patch) as (keyof ModelState)[]).some(
      (k) => this.modelState[k] !== next[k]
    )
    this.modelState = next
    if (changed) {
      this.emit('modelState', this.getModelState())
    }
  }
```

> Note: the old `constructor` (old lines 65–68) is now included above — do not leave a duplicate constructor.

- [ ] **Step 3: Rewrite `checkConnection`**

Replace `checkConnection` (old lines 92–130) with:

```ts
  async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(OLLAMA_BASE_URL, { signal: controller.signal })
      clearTimeout(timeout)

      if (response.ok) {
        const models = await this.getModels()
        const normalize = (name: string) => name.replace(/:latest$/, '')
        const hasActiveModel = models.some(
          (m) => normalize(m.name) === normalize(this.modelState.model)
        )
        // Don't clobber an in-flight download with a connection check.
        if (this.modelState.phase === 'downloading' || this.modelState.phase === 'verifying') {
          this.setModelState({ reachable: true })
          return true
        }
        this.setModelState({
          reachable: true,
          phase: hasActiveModel ? 'ready' : 'idle',
          progress: hasActiveModel ? 100 : 0,
          error: null
        })
        console.log(
          `[OllamaService] Connection check: server=OK, model=${this.modelState.model}, available=${hasActiveModel}`
        )
        return true
      }

      this.setModelState({ reachable: false })
      return false
    } catch {
      console.log('[OllamaService] Connection check: server not reachable')
      this.setModelState({ reachable: false })
      return false
    }
  }
```

- [ ] **Step 4: Update connection monitoring guard**

Replace `startConnectionMonitoring` (old lines 132–140) with:

```ts
  startConnectionMonitoring(intervalMs = 30000): void {
    this.stopConnectionMonitoring()
    this.checkConnection()
    this.connectionCheckInterval = setInterval(() => {
      const phase = this.modelState.phase
      if (phase !== 'downloading' && phase !== 'verifying') {
        this.checkConnection()
      }
    }, intervalMs)
  }
```

(`getModels` and `stopConnectionMonitoring` stay unchanged.)

- [ ] **Step 5: Rewrite `pullModel` with lifecycle + abort + supersede; add `cancelPull`**

Replace `pullModel` (old lines 168–226) with:

```ts
  async pullModel(modelName: string): Promise<boolean> {
    // Supersede any in-flight pull (rapid toggling).
    if (this.currentPull) {
      this.currentPull.abort()
      this.currentPull = null
    }
    const controller = new AbortController()
    this.currentPull = controller

    this.setModelState({ phase: 'downloading', model: modelName, progress: 0, error: null })

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true }),
        signal: controller.signal
      })

      if (!response.ok || !response.body) {
        throw new Error(`Pull failed: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // A newer selection superseded this pull — stop processing stale stream.
        if (this.currentPull !== controller) {
          return false
        }

        const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const progress: OllamaPullProgress = JSON.parse(line)
            const patch: Partial<ModelState> = {}
            if (progress.total && progress.completed) {
              patch.progress = Math.round((progress.completed / progress.total) * 100)
            }
            const mapped = progress.status ? mapOllamaPullStatus(progress.status) : null
            if (mapped) patch.phase = mapped
            if (Object.keys(patch).length > 0) this.setModelState(patch)
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // Verify the model is now available.
      this.setModelState({ phase: 'verifying' })
      const models = await this.getModels()
      const pulled = models.some((m) => m.name === modelName)

      if (pulled) {
        this.setModelState({ phase: 'ready', progress: 100, error: null })
        console.log(`[OllamaService] Successfully pulled model: ${modelName}`)
      } else {
        this.setModelState({
          phase: 'error',
          error: { kind: 'generic', raw: 'Model not found after pull' }
        })
        console.error(`[OllamaService] Model not found after pull: ${modelName}`)
      }
      return pulled
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`[OllamaService] Pull aborted: ${modelName}`)
        // Re-derive state from server; don't leave a stuck "downloading".
        await this.checkConnection()
        return false
      }
      const raw = error instanceof Error ? error.message : String(error)
      console.error(`[OllamaService] Failed to pull model ${modelName}:`, error)
      this.setModelState({ phase: 'error', error: { kind: classifyPullError(raw), raw } })
      return false
    } finally {
      if (this.currentPull === controller) this.currentPull = null
    }
  }

  cancelPull(): void {
    if (this.currentPull) {
      console.log('[OllamaService] Cancelling in-flight pull')
      this.currentPull.abort()
      this.currentPull = null
    }
  }
```

- [ ] **Step 6: Update `deleteModel` status handling**

In `deleteModel` (old lines 228–249), replace the active-model branch:
```ts
        if (modelName === this.activeModel) {
          this.setStatus('connected')
        }
```
with:
```ts
        if (modelName === this.modelState.model) {
          this.setModelState({ phase: 'idle', progress: 0 })
        }
```

- [ ] **Step 7: Update inference/chat readiness guards**

In `runChat` (old line 314) and `runInference` (old line 380), replace both occurrences of:
```ts
    if (this.status !== 'ready') {
      throw new Error(`Ollama not ready (status: ${this.status})`)
    }
```
with:
```ts
    if (this.modelState.phase !== 'ready') {
      throw new Error(`Ollama not ready (phase: ${this.modelState.phase})`)
    }
```

- [ ] **Step 8: Format and type-check**

Run: `cd /Users/tweizh/DEV/Intevia/Knovy-model-dl && pnpm format && pnpm exec tsc --noEmit -p tsconfig.node.json 2>&1 | head -30`
Expected: no NEW errors referencing `ollamaService.ts` (pre-existing unrelated errors elsewhere are acceptable; do not fix them). Fix any error originating in `ollamaService.ts`.

- [ ] **Step 9: Re-run unit tests (regression)**

Run: `cd /Users/tweizh/DEV/Intevia/Knovy-model-dl && pnpm test:run`
Expected: all tests pass (record-gate, ollama-errors, release-config).

- [ ] **Step 10: Commit**

```bash
cd /Users/tweizh/DEV/Intevia/Knovy-model-dl
git add src/main/ollamaService.ts
git commit -m "Refactor(ollama): Replace status with ModelState lifecycle + cancel/supersede"
```

---

## Task 4: Wire main-process IPC handlers and settings

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Add `aiCorrection` to settings defaults**

In `loadSettings` (lines 360–374), add `aiCorrection: 'on'` to BOTH returned default objects, e.g. change the success-path return to:
```ts
    return {
      language: 'zh-TW',
      customPrompt: '',
      contentProtection: false,
      aiCorrection: 'on',
      ...parsed,
      autoTrigger
    }
```
and the catch-path return to:
```ts
    return {
      language: 'zh-TW',
      customPrompt: '',
      contentProtection: false,
      aiCorrection: 'on',
      autoTrigger: DEFAULT_AUTO_TRIGGER_SETTINGS
    }
```

- [ ] **Step 2: Add a model-state broadcaster + apply-pending helper near the service setup**

Replace the Ollama IPC handler block (lines 1968–2033) with the following. It removes `ollama:get-status`, `ollama:pull-model`, `ollama:set-model`, the `pullProgress`/`statusChanged` forwarders, and adds the new surface:

```ts
  // Ollama management IPC handlers
  const ollamaService = getOllamaService()

  // Broadcast full model-state to all windows whenever it changes.
  ollamaService.on('modelState', (state) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('ollama:model-state', state)
      }
    }
  })

  ipcMain.handle('ollama:get-model-state', async () => {
    return ollamaService.getModelState()
  })

  ipcMain.handle('ollama:get-models', async () => {
    return await ollamaService.getModels()
  })

  // Unified select+download. If a model is installed -> instant swap.
  // If a recording is active -> store as pending (finish-then-switch).
  // Otherwise -> set active + download (lifecycle drives progress).
  ipcMain.handle('ollama:select-model', async (_event, modelName: string) => {
    const installed = await ollamaService.getModels()
    const normalize = (n: string) => n.replace(/:latest$/, '')
    const isInstalled = installed.some((m) => normalize(m.name) === normalize(modelName))

    if (isInstalled) {
      ollamaService.setActiveModel(modelName)
      ollamaService.setPendingModel(null)
      const current = await loadSettings()
      await saveSettings({ ...current, ollamaModel: modelName })
      await ollamaService.checkConnection()
      return { success: true }
    }

    if (isScreenSharing) {
      // Defer the switch until recording stops.
      ollamaService.setPendingModel(modelName)
      return { success: true }
    }

    ollamaService.setActiveModel(modelName)
    ollamaService.setPendingModel(null)
    const current = await loadSettings()
    await saveSettings({ ...current, ollamaModel: modelName })
    const success = await ollamaService.pullModel(modelName)
    return { success }
  })

  ipcMain.handle('ollama:cancel-pull', async () => {
    ollamaService.cancelPull()
    await ollamaService.checkConnection()
    return { success: true }
  })

  ipcMain.handle('ollama:delete-model', async (_event, modelName: string) => {
    const success = await ollamaService.deleteModel(modelName)
    return { success }
  })

  ipcMain.handle('ollama:check-connection', async () => {
    const reachable = await ollamaService.checkConnection()
    return { reachable }
  })

  ipcMain.handle('ollama:get-ai-correction', async () => {
    const settings = await loadSettings()
    return { mode: settings.aiCorrection === 'off' ? 'off' : 'on' }
  })

  ipcMain.handle('ollama:set-ai-correction', async (_event, mode: 'on' | 'off') => {
    const current = await loadSettings()
    await saveSettings({ ...current, aiCorrection: mode === 'off' ? 'off' : 'on' })
    return { success: true }
  })
```

- [ ] **Step 3: Apply the pending model when a recording stops**

In the `set-screenshare-state` handler (lines 1257–1276), inside the `else` branch that handles stop, after `activeScreenSourceId = null` add:

```ts
      // Finish-then-switch: apply any model chosen during the recording.
      const ollamaSvc = getOllamaService()
      const pending = ollamaSvc.getModelState().pendingModel
      if (pending) {
        ollamaSvc.setPendingModel(null)
        ollamaSvc.setActiveModel(pending)
        const current = await loadSettings()
        await saveSettings({ ...current, ollamaModel: pending })
        // Fire-and-forget the download; UI tracks it via ollama:model-state.
        ollamaSvc.pullModel(pending).catch((e) =>
          console.error('[main/index.ts] Pending model pull failed:', e)
        )
      }
```

- [ ] **Step 4: Switch the enhancement gate to phase-based readiness**

In the `transcription:data` handler, replace line 1354:
```ts
        if (ollamaSvc.getStatus() === 'ready') {
```
with:
```ts
        if (ollamaSvc.getModelState().phase === 'ready') {
```
and replace the log on lines 1422–1424:
```ts
          console.log(
            `[main/index.ts] Ollama not ready (${ollamaSvc.getStatus()}), broadcasting raw text for ${transcriptId}`
          )
```
with:
```ts
          console.log(
            `[main/index.ts] Ollama not ready (${ollamaSvc.getModelState().phase}), broadcasting raw text for ${transcriptId}`
          )
```

- [ ] **Step 5: Type-check main**

Run: `cd /Users/tweizh/DEV/Intevia/Knovy-model-dl && pnpm exec tsc --noEmit -p tsconfig.node.json 2>&1 | grep -i "index.ts\|ollamaService" | head -20`
Expected: no errors from `index.ts` related to removed `getStatus`/`setStatus` (search the file for any remaining `getStatus(`/`setStatus(` references and fix them to `getModelState().phase`).

- [ ] **Step 6: Commit**

```bash
cd /Users/tweizh/DEV/Intevia/Knovy-model-dl
git add src/main/index.ts
git commit -m "Feat(ollama): Wire model-state IPC, unified select, ai-correction, pending switch"
```

---

## Task 5: Update preload channel whitelist

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Update `on` channels**

In the `on` `validChannels` array, replace the two lines (193–194):
```ts
      'ollama:status-changed',
      'ollama:pull-progress'
```
with:
```ts
      'ollama:model-state'
```

- [ ] **Step 2: Update `invoke` channels**

In the `invoke` `validChannels` array, replace the Ollama block (288–293):
```ts
      'ollama:get-status',
      'ollama:get-models',
      'ollama:pull-model',
      'ollama:set-model',
      'ollama:delete-model',
      'ollama:check-connection',
```
with:
```ts
      'ollama:get-model-state',
      'ollama:get-models',
      'ollama:select-model',
      'ollama:cancel-pull',
      'ollama:delete-model',
      'ollama:check-connection',
      'ollama:get-ai-correction',
      'ollama:set-ai-correction',
```

- [ ] **Step 3: Commit**

```bash
cd /Users/tweizh/DEV/Intevia/Knovy-model-dl
git add src/preload/index.ts
git commit -m "Feat(preload): Whitelist new ollama model-state channels"
```

---

## Task 6: Renderer hook `useOllamaModelState`

**Files:**
- Create: `src/renderer/src/hooks/useOllamaModelState.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useState, useEffect, useCallback } from 'react'
import type { ModelPhase, AiCorrectionMode } from '@/lib/recordGate'

export interface ModelStateError {
  kind: 'disk-full' | 'network' | 'generic'
  raw: string
}

export interface OllamaModel {
  name: string
  size: number
  modifiedAt: string
  digest: string
}

export interface ModelState {
  phase: ModelPhase
  model: string
  progress: number
  reachable: boolean
  error: ModelStateError | null
  pendingModel: string | null
}

const INITIAL: ModelState = {
  phase: 'idle',
  model: '',
  progress: 0,
  reachable: false,
  error: null,
  pendingModel: null
}

export function useOllamaModelState() {
  const [state, setState] = useState<ModelState>(INITIAL)
  const [models, setModels] = useState<OllamaModel[]>([])
  const [aiCorrection, setAiCorrectionState] = useState<AiCorrectionMode>('on')

  const refreshState = useCallback(async () => {
    try {
      const s = await window.electronAPI.invoke('ollama:get-model-state')
      if (s) setState(s)
    } catch {
      /* leave previous state */
    }
  }, [])

  const refreshModels = useCallback(async () => {
    try {
      const list = await window.electronAPI.invoke('ollama:get-models')
      setModels(list || [])
    } catch {
      setModels([])
    }
  }, [])

  const refreshAiCorrection = useCallback(async () => {
    try {
      const r = await window.electronAPI.invoke('ollama:get-ai-correction')
      setAiCorrectionState(r?.mode === 'off' ? 'off' : 'on')
    } catch {
      setAiCorrectionState('on')
    }
  }, [])

  useEffect(() => {
    refreshState()
    refreshModels()
    refreshAiCorrection()
    const unsub = window.electronAPI.on('ollama:model-state', (s: ModelState) => {
      setState(s)
      // Installed set may have changed when a pull reaches "ready".
      if (s.phase === 'ready' || s.phase === 'idle') refreshModels()
    })
    return () => unsub()
  }, [refreshState, refreshModels, refreshAiCorrection])

  const selectModel = useCallback(async (name: string) => {
    await window.electronAPI.invoke('ollama:select-model', name)
  }, [])

  const cancelPull = useCallback(async () => {
    await window.electronAPI.invoke('ollama:cancel-pull')
  }, [])

  const retry = useCallback(async () => {
    await window.electronAPI.invoke('ollama:select-model', state.model)
  }, [state.model])

  const deleteModel = useCallback(
    async (name: string) => {
      await window.electronAPI.invoke('ollama:delete-model', name)
      await refreshModels()
    },
    [refreshModels]
  )

  const checkConnection = useCallback(async () => {
    await window.electronAPI.invoke('ollama:check-connection')
    await refreshState()
    await refreshModels()
  }, [refreshState, refreshModels])

  const setAiCorrection = useCallback(async (mode: AiCorrectionMode) => {
    await window.electronAPI.invoke('ollama:set-ai-correction', mode)
    setAiCorrectionState(mode)
  }, [])

  return {
    state,
    models,
    aiCorrection,
    selectModel,
    cancelPull,
    retry,
    deleteModel,
    checkConnection,
    setAiCorrection,
    refreshState
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tweizh/DEV/Intevia/Knovy-model-dl
git add src/renderer/src/hooks/useOllamaModelState.ts
git commit -m "Feat(renderer): Add useOllamaModelState hook"
```

---

## Task 7: Add translation keys

**Files:**
- Modify: `src/renderer/src/lib/translations.ts`

- [ ] **Step 1: Add keys to the `en-US` block**

Immediately after the `aiModelsTab: 'AI Models',` line (line 106) in the `'en-US'` object, add:
```ts
    aiCorrectionTitle: 'AI Auto-Correction',
    aiCorrectionDescription:
      'Use a local AI model to correct transcriptions. Turn off to record raw transcription only (no LLM, lower memory use).',
    aiCorrectionOn: 'On',
    aiCorrectionOff: 'Off',
    modelDownloading: 'Downloading model',
    modelVerifying: 'Verifying model',
    modelReady: 'Ready',
    modelError: 'Download error',
    preparingModel: 'Preparing model',
    pendingSwitchNotice: 'Will switch model after recording ends',
    gateNoModelTitle: 'No AI model installed',
    gateNoModelBody:
      'Download a model to enable AI transcription correction, or record raw transcription without it.',
    gateDownloadingTitle: 'Model is downloading',
    gateDownloadingBody: 'The AI model is still downloading. You can wait, or record raw for now.',
    gateErrorTitle: 'AI model unavailable',
    gateErrorOllamaUnavailable:
      'Ollama is not available. Install and start Ollama, or record raw transcription.',
    gateErrorDiskFull: 'Not enough disk space to download the model. Free up space and retry.',
    gateErrorNetwork: 'Network error while downloading the model. Check your connection and retry.',
    gateErrorGeneric: 'The model download failed. Retry, or record raw transcription.',
    btnDownloadModel: 'Download model',
    btnRecordRaw: 'Record raw',
    btnDontAskAgain: "Record raw & don't ask again",
    btnRetry: 'Retry',
    btnStartOllama: 'Install Ollama',
    btnCancelDownload: 'Cancel download',
```

- [ ] **Step 2: Add the same keys to the `zh-TW` block**

Immediately after the `aiModelsTab: 'AI 模型',` line (line 294) in the `'zh-TW'` object, add:
```ts
    aiCorrectionTitle: 'AI 自動校正',
    aiCorrectionDescription:
      '使用本機 AI 模型校正逐字稿。關閉後僅錄製原始逐字稿（不使用 LLM，記憶體用量較低）。',
    aiCorrectionOn: '開啟',
    aiCorrectionOff: '關閉',
    modelDownloading: '正在下載模型',
    modelVerifying: '正在驗證模型',
    modelReady: '就緒',
    modelError: '下載錯誤',
    preparingModel: '正在準備模型',
    pendingSwitchNotice: '錄製結束後將切換模型',
    gateNoModelTitle: '尚未安裝 AI 模型',
    gateNoModelBody: '下載模型以啟用 AI 逐字稿校正，或不使用模型直接錄製原始逐字稿。',
    gateDownloadingTitle: '模型下載中',
    gateDownloadingBody: 'AI 模型仍在下載中。您可以等待，或先錄製原始逐字稿。',
    gateErrorTitle: 'AI 模型無法使用',
    gateErrorOllamaUnavailable: 'Ollama 無法使用。請安裝並啟動 Ollama，或錄製原始逐字稿。',
    gateErrorDiskFull: '磁碟空間不足，無法下載模型。請釋放空間後重試。',
    gateErrorNetwork: '下載模型時發生網路錯誤。請檢查連線後重試。',
    gateErrorGeneric: '模型下載失敗。請重試，或錄製原始逐字稿。',
    btnDownloadModel: '下載模型',
    btnRecordRaw: '錄製原始逐字稿',
    btnDontAskAgain: '錄製原始逐字稿並不再詢問',
    btnRetry: '重試',
    btnStartOllama: '安裝 Ollama',
    btnCancelDownload: '取消下載',
```

- [ ] **Step 3: Add the keys to the `TranslationKey` union**

After the `| 'aiModelsTab'` entry (line 484), add one union member per new key:
```ts
  | 'aiCorrectionTitle'
  | 'aiCorrectionDescription'
  | 'aiCorrectionOn'
  | 'aiCorrectionOff'
  | 'modelDownloading'
  | 'modelVerifying'
  | 'modelReady'
  | 'modelError'
  | 'preparingModel'
  | 'pendingSwitchNotice'
  | 'gateNoModelTitle'
  | 'gateNoModelBody'
  | 'gateDownloadingTitle'
  | 'gateDownloadingBody'
  | 'gateErrorTitle'
  | 'gateErrorOllamaUnavailable'
  | 'gateErrorDiskFull'
  | 'gateErrorNetwork'
  | 'gateErrorGeneric'
  | 'btnDownloadModel'
  | 'btnRecordRaw'
  | 'btnDontAskAgain'
  | 'btnRetry'
  | 'btnStartOllama'
  | 'btnCancelDownload'
```

- [ ] **Step 4: Type-check renderer**

Run: `cd /Users/tweizh/DEV/Intevia/Knovy-model-dl && pnpm exec tsc --noEmit -p tsconfig.web.json 2>&1 | grep -i "translations.ts" | head`
Expected: no errors from `translations.ts` (both locale objects must contain every key in the union).

- [ ] **Step 5: Commit**

```bash
cd /Users/tweizh/DEV/Intevia/Knovy-model-dl
git add src/renderer/src/lib/translations.ts
git commit -m "Feat(i18n): Add model-download/gate translation keys (en + zh-TW)"
```

---

## Task 8: Rewrite `OllamaSettings` (unified select+download, cancel, AI-correction toggle, pending)

**Files:**
- Modify: `src/renderer/src/components/settings/OllamaSettings.tsx`

- [ ] **Step 1: Replace the whole component file**

Full replacement:
```tsx
import { Bot, Download, Trash2, ExternalLink, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'
import { useI18n } from '@/hooks/useI18n'
import { useOllamaModelState } from '@/hooks/useOllamaModelState'

const RECOMMENDED_MODEL = 'gemma4:e4b'
const PULLABLE_MODELS = [
  { name: 'qwen3.5:2b', label: 'Qwen 3.5 2B', description: 'Lightweight, fastest, lowest memory' },
  { name: 'qwen3.5:4b', label: 'Qwen 3.5 4B', description: 'Balanced speed and quality (text + vision)' },
  { name: 'gemma4:e2b', label: 'Gemma 4 E2B', description: 'Google, fast, low memory' },
  { name: 'gemma4:e4b', label: 'Gemma 4 E4B', description: 'Recommended - vision + quality' }
]

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function OllamaSettings() {
  const { t } = useI18n()
  const { state, models, aiCorrection, selectModel, cancelPull, deleteModel, checkConnection, setAiCorrection } =
    useOllamaModelState()

  const isBusy = state.phase === 'downloading' || state.phase === 'verifying'

  const phaseLabel = () => {
    switch (state.phase) {
      case 'downloading':
        return t('modelDownloading')
      case 'verifying':
        return t('modelVerifying')
      case 'ready':
        return t('modelReady')
      case 'error':
        return t('modelError')
      default:
        return state.reachable ? t('aiCorrectionOn') : ''
    }
  }

  const errorMessage = () => {
    if (!state.error) return t('gateErrorGeneric')
    switch (state.error.kind) {
      case 'disk-full':
        return t('gateErrorDiskFull')
      case 'network':
        return t('gateErrorNetwork')
      default:
        return t('gateErrorGeneric')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">{t('aiModelsTab')}</h2>
        <p className="text-sm text-muted-foreground">
          Manage local AI models for transcription enhancement via Ollama.
        </p>
      </div>

      {/* AI Auto-Correction toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium">{t('aiCorrectionTitle')}</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground flex-1">{t('aiCorrectionDescription')}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm">{aiCorrection === 'on' ? t('aiCorrectionOn') : t('aiCorrectionOff')}</span>
              <Switch
                checked={aiCorrection === 'on'}
                onCheckedChange={(checked) => setAiCorrection(checked ? 'on' : 'off')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium">Ollama Connection</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label className="text-sm font-medium">Status</Label>
              <div className="mt-1 flex items-center gap-1.5">
                {!state.reachable ? (
                  <>
                    <XCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Not connected</span>
                  </>
                ) : state.phase === 'ready' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600">{t('modelReady')}</span>
                  </>
                ) : (
                  <span className="text-sm text-yellow-600">{phaseLabel()}</span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={checkConnection}>
              Check Connection
            </Button>
          </div>

          {!state.reachable && (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Ollama is not detected. Install it to enable local AI transcription enhancement.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.electronAPI.openExternal('https://ollama.com/download')}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                {t('btnStartOllama')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active model: unified select + download */}
      {state.reachable && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-medium">Active Model</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <Label className="text-sm font-medium">Select model for enhancement</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Choosing a model downloads it automatically if needed.
                </p>
              </div>
              <Select value={state.model} onValueChange={selectModel} disabled={isBusy}>
                <SelectTrigger className="w-[240px] bg-background/50">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {PULLABLE_MODELS.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      <div className="flex items-center gap-2">
                        <span>{m.label}</span>
                        <span className="text-xs text-muted-foreground">- {m.description}</span>
                        {m.name === RECOMMENDED_MODEL && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Recommended
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {state.pendingModel && (
              <p className="text-xs text-yellow-600">
                {t('pendingSwitchNotice')}: {state.pendingModel}
              </p>
            )}

            {isBusy && (
              <div className="space-y-2">
                <Progress value={state.progress} className="h-2" />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {phaseLabel()} {state.progress > 0 && `(${state.progress}%)`}
                  </p>
                  <Button variant="ghost" size="sm" onClick={cancelPull}>
                    {t('btnCancelDownload')}
                  </Button>
                </div>
              </div>
            )}

            {state.phase === 'error' && (
              <div className="rounded-lg bg-destructive/10 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-destructive text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  {errorMessage()}
                </div>
                <Button variant="outline" size="sm" onClick={() => selectModel(state.model)}>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5" />
                  {t('btnRetry')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Installed models */}
      {state.reachable && models.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-medium">Installed Models</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {models.map((model) => (
                <div key={model.name} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{model.name}</span>
                    {model.name === state.model && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">
                        Active
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{formatBytes(model.size)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteModel(model.name)}
                    disabled={model.name === state.model}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check renderer**

Run: `cd /Users/tweizh/DEV/Intevia/Knovy-model-dl && pnpm exec tsc --noEmit -p tsconfig.web.json 2>&1 | grep -i "OllamaSettings\|useOllamaModelState\|recordGate" | head`
Expected: no errors from these files.

- [ ] **Step 3: Commit**

```bash
cd /Users/tweizh/DEV/Intevia/Knovy-model-dl
git add src/renderer/src/components/settings/OllamaSettings.tsx
git commit -m "Feat(settings): Unify model select+download with cancel, errors, AI-correction toggle"
```

---

## Task 9: Record-gate dialog + wire into MainController; record-button indicator

**Files:**
- Create: `src/renderer/src/components/ModelGateDialog.tsx`
- Modify: `src/renderer/src/components/MainController.tsx`
- Modify: `src/renderer/src/components/MainControlBar.tsx`

- [ ] **Step 1: Create the gate dialog component**

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useI18n } from '@/hooks/useI18n'
import type { ModelState } from '@/hooks/useOllamaModelState'

export type GateKind = 'no-model' | 'downloading' | 'error' | null

interface ModelGateDialogProps {
  kind: GateKind
  state: ModelState
  onClose: () => void
  onDownload: () => void
  onRecordRaw: () => void
  onDontAskAgain: () => void
  onRetry: () => void
  onStartOllama: () => void
}

export function ModelGateDialog({
  kind,
  state,
  onClose,
  onDownload,
  onRecordRaw,
  onDontAskAgain,
  onRetry,
  onStartOllama
}: ModelGateDialogProps) {
  const { t } = useI18n()
  if (!kind) return null

  const title =
    kind === 'no-model'
      ? t('gateNoModelTitle')
      : kind === 'downloading'
        ? t('gateDownloadingTitle')
        : t('gateErrorTitle')

  const body = () => {
    if (kind === 'no-model') return t('gateNoModelBody')
    if (kind === 'downloading') return t('gateDownloadingBody')
    if (!state.reachable) return t('gateErrorOllamaUnavailable')
    if (state.error?.kind === 'disk-full') return t('gateErrorDiskFull')
    if (state.error?.kind === 'network') return t('gateErrorNetwork')
    return t('gateErrorGeneric')
  }

  return (
    <Dialog open={!!kind} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body()}</DialogDescription>
        </DialogHeader>

        {kind === 'downloading' && (
          <div className="space-y-1">
            <Progress value={state.progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {state.progress > 0 ? `${state.progress}%` : ''}
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-col gap-2">
          {kind === 'no-model' && (
            <>
              <Button onClick={onDownload}>{t('btnDownloadModel')}</Button>
              <Button variant="outline" onClick={onRecordRaw}>
                {t('btnRecordRaw')}
              </Button>
              <Button variant="ghost" onClick={onDontAskAgain}>
                {t('btnDontAskAgain')}
              </Button>
            </>
          )}
          {kind === 'downloading' && (
            <Button variant="outline" onClick={onRecordRaw}>
              {t('btnRecordRaw')}
            </Button>
          )}
          {kind === 'error' && (
            <>
              {state.reachable ? (
                <Button onClick={onRetry}>{t('btnRetry')}</Button>
              ) : (
                <Button onClick={onStartOllama}>{t('btnStartOllama')}</Button>
              )}
              <Button variant="outline" onClick={onRecordRaw}>
                {t('btnRecordRaw')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Wire the gate into `MainController`**

In `MainController.tsx`, add imports near the top (after existing imports):
```tsx
import { useOllamaModelState } from '@/hooks/useOllamaModelState'
import { decideRecordAction } from '@/lib/recordGate'
import { ModelGateDialog, type GateKind } from './ModelGateDialog'
```

Add hook usage + gate state inside the component, after the `useScreenShare` destructuring block (after line 29):
```tsx
  const RECOMMENDED_MODEL = 'gemma4:e4b'
  const ollama = useOllamaModelState()
  const [gateKind, setGateKind] = useState<GateKind>(null)
```

Replace `handleToggleScreenShare` (lines 245–255) with a gated version:
```tsx
  const startRecordingNow = useCallback(async () => {
    setGateKind(null)
    await toggleScreenShare()
  }, [toggleScreenShare])

  const handleToggleScreenShare = useCallback(async () => {
    if (isSummarizing) return

    if (isScreenSharing) {
      window.electronAPI.send('app:graceful-stop-and-execute', { postAction: 'stop' })
      return
    }

    // Starting: consult the gate against a freshly refreshed model-state.
    await ollama.refreshState()
    const s = await window.electronAPI.invoke('ollama:get-model-state')
    const action = decideRecordAction({
      aiCorrection: ollama.aiCorrection,
      phase: s?.phase ?? 'idle',
      reachable: s?.reachable ?? false
    })

    switch (action.type) {
      case 'start-enhanced':
      case 'start-raw':
        await startRecordingNow()
        break
      case 'prompt-no-model':
        setGateKind('no-model')
        break
      case 'prompt-downloading':
        setGateKind('downloading')
        break
      case 'prompt-error':
        setGateKind('error')
        break
    }
  }, [isSummarizing, isScreenSharing, ollama, toggleScreenShare, startRecordingNow])
```

Render the dialog: change the JSX return so the dialog is included. Replace the outer wrapper's closing so the component returns a fragment containing both the existing `<div>` and the dialog. Specifically, wrap the existing return in a fragment and append before its end:
```tsx
      <ModelGateDialog
        kind={gateKind}
        state={ollama.state}
        onClose={() => setGateKind(null)}
        onDownload={() => ollama.selectModel(RECOMMENDED_MODEL)}
        onRecordRaw={startRecordingNow}
        onDontAskAgain={async () => {
          await ollama.setAiCorrection('off')
          await startRecordingNow()
        }}
        onRetry={() => ollama.selectModel(ollama.state.model)}
        onStartOllama={() => window.electronAPI.openExternal('https://ollama.com/download')}
      />
```

The final return becomes:
```tsx
  return (
    <>
      <div className="flex flex-col h-screen rounded-lg glass-popover">
        <MainControlBar
          isAlwaysOnTop={isAlwaysOnTop}
          toggleAlwaysOnTop={toggleAlwaysOnTop}
          minimizeWindow={minimizeWindow}
          closeWindow={closeWindow}
          isScreenSharing={isScreenSharing}
          onToggleScreenShare={handleToggleScreenShare}
          isSummarizing={isSummarizing}
          recordingDuration={recordingDuration}
          onTogglePanel={handleTogglePanel}
          openPanels={openPanels}
          isSettingsOpen={isSettingsOpen}
          preparingProgress={
            ollama.state.phase === 'downloading' || ollama.state.phase === 'verifying'
              ? ollama.state.progress
              : null
          }
        />
        <RealTimeAnalysis
          isScreenSharing={isScreenSharing}
          systemAudioStream={currentSystemAudioStream}
          onTextResponse={handleTranscriptionResponse}
          customPrompt={customPrompt}
          language={language}
        />
      </div>
      <ModelGateDialog
        kind={gateKind}
        state={ollama.state}
        onClose={() => setGateKind(null)}
        onDownload={() => ollama.selectModel(RECOMMENDED_MODEL)}
        onRecordRaw={startRecordingNow}
        onDontAskAgain={async () => {
          await ollama.setAiCorrection('off')
          await startRecordingNow()
        }}
        onRetry={() => ollama.selectModel(ollama.state.model)}
        onStartOllama={() => window.electronAPI.openExternal('https://ollama.com/download')}
      />
    </>
  )
```

> Ensure `useState` and `useCallback` are imported (they already are on line 2).

- [ ] **Step 3: Add the preparing indicator to `MainControlBar`**

In `MainControlBar.tsx`, add `preparingProgress?: number | null` to `MainControlBarProps` (after `isSettingsOpen: boolean`):
```tsx
  preparingProgress?: number | null
```
Destructure it in the function signature (add after `isSettingsOpen`):
```tsx
  preparingProgress
```
Then change the record button label expression (lines 66–71) so that when not recording and a model is preparing, it shows progress. Replace:
```tsx
          ) : (
            <>
              <MicIcon className="h-8 w-8" />
              {isScreenSharing ? formatTime(recordingDuration) : 'Listen'}
            </>
          )}
```
with:
```tsx
          ) : (
            <>
              <MicIcon className="h-8 w-8" />
              {isScreenSharing
                ? formatTime(recordingDuration)
                : preparingProgress != null
                  ? `${t('preparingModel')} ${preparingProgress}%`
                  : 'Listen'}
            </>
          )}
```

- [ ] **Step 4: Type-check renderer**

Run: `cd /Users/tweizh/DEV/Intevia/Knovy-model-dl && pnpm exec tsc --noEmit -p tsconfig.web.json 2>&1 | grep -i "MainController\|MainControlBar\|ModelGateDialog" | head`
Expected: no errors from these files.

- [ ] **Step 5: Commit**

```bash
cd /Users/tweizh/DEV/Intevia/Knovy-model-dl
git add src/renderer/src/components/ModelGateDialog.tsx src/renderer/src/components/MainController.tsx src/renderer/src/components/MainControlBar.tsx
git commit -m "Feat(record): Gate recording on model-ready with actionable dialog + progress indicator"
```

---

## Task 10: Full type-check, format, and test sweep

**Files:** none (verification)

- [ ] **Step 1: Format**

Run: `cd /Users/tweizh/DEV/Intevia/Knovy-model-dl && pnpm format`

- [ ] **Step 2: Type-check both projects**

Run: `cd /Users/tweizh/DEV/Intevia/Knovy-model-dl && pnpm exec tsc --noEmit -p tsconfig.node.json && pnpm exec tsc --noEmit -p tsconfig.web.json`
Expected: no errors in any file created/modified by this plan. (Pre-existing unrelated errors elsewhere — see project memory "Pre-existing TS errors" — are out of scope; do not fix.)

- [ ] **Step 3: Unit tests**

Run: `cd /Users/tweizh/DEV/Intevia/Knovy-model-dl && pnpm test:run`
Expected: PASS — `record-gate`, `ollama-errors`, `release-config`, and the local-transcription suite as applicable.

- [ ] **Step 4: Commit any formatting changes**

```bash
cd /Users/tweizh/DEV/Intevia/Knovy-model-dl
git add -A
git commit -m "Chore: Format and finalize model-download UX" || echo "nothing to commit"
```

---

## Task 11: Manual verification with Chrome DevTools (CDP)

**Files:** none (manual QA — driven by the human + assistant, not a subagent)

> The app runs via `pnpm dev` (Electron). Per project rules, only start it when the user asks. Use the chrome-devtools MCP against the renderer to drive these checks. Each item maps to an acceptance criterion / edge case.

- [ ] **AC: Recording cannot start against a non-ready model.** With AI-correction ON and the active model not installed, click Listen → gate dialog appears (no recording starts). Confirm `isScreenSharing` stays false.
- [ ] **AC: Switching shows a blocking/loading state with progress.** In Settings, select an uninstalled model → progress bar advances, phase label shows Downloading → Verifying → Ready. Record button shows "Preparing model … N%".
- [ ] **AC: Download failure shows actionable error.** Simulate failure (e.g. stop Ollama mid-pull, or select with no network) → error card with classified message + Retry; gate dialog (when recording attempted) shows the same.
- [ ] **AC: In-flight switch is defined (finish-then-switch).** Start recording, open Settings, select a different uninstalled model → "Will switch model after recording ends: <name>" appears, no download starts; stop recording → download begins automatically.
- [ ] **Edge: No model + Record raw.** Delete all models, click Listen → choice dialog → "Record raw" starts recording; transcription arrives raw (main log: "Ollama not ready … broadcasting raw text").
- [ ] **Edge: Don't ask again.** Click Listen → "Record raw & don't ask again" → recording starts and aiCorrection persists 'off'; relaunch → Listen starts raw immediately with no prompt.
- [ ] **Edge: Ollama not running.** Quit Ollama, click Listen → error dialog "Ollama is not available" with Install + Record raw.
- [ ] **Edge: Rapid toggling.** In Settings, quickly select model A then model B → only B downloads; A's progress stops (superseded), no stuck state.
- [ ] **Edge: Cancel.** Start a download, click Cancel download → returns to idle/ready cleanly, no stuck "downloading".
- [ ] **Edge: Model deleted out-of-band.** With a ready model, `ollama rm <model>` in a terminal, click Listen → gate re-verifies and shows no-model dialog (not a false "ready").

---

## Self-Review (completed during planning)

- **Spec coverage:** lifecycle states (Task 3) ✓; gate function + dialog (Tasks 1, 9) ✓; unified select+download (Tasks 4, 8) ✓; cancel/supersede (Tasks 3, 4) ✓; finish-then-switch (Tasks 4, 8, 9) ✓; aiCorrection on/off + don't-ask-again + default-on (Tasks 4, 6, 8, 9) ✓; error classification + actionable messages (Tasks 2, 8, 9) ✓; Ollama-unavailable handling (Tasks 3, 9) ✓; catalog update + default model (Tasks 3, 8) ✓; out-of-band deletion re-verify (Task 9 gate refresh) ✓; translations (Task 7) ✓; tests (Tasks 1, 2) ✓; CDP verification (Task 11) ✓.
- **Placeholder scan:** none — every code step contains full code.
- **Type consistency:** `ModelPhase`, `ModelState`, `decideRecordAction`, `selectModel`, `cancelPull`, `classifyPullError`, `mapOllamaPullStatus`, channel names, and `aiCorrection` are used identically across tasks.
