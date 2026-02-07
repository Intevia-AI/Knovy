# Local Ollama Transcription Enhancement
**Date:** February 7, 2026
**Objective:** Replace cloud-based Gemini API (via Supabase Edge Functions) with local Ollama for transcription enhancement — zero cost, no rate limits, fully on-device

## Executive Summary

The transcription enhancement pipeline previously sent each whisper.cpp transcription to a Supabase Edge Function, which called the Gemini API (`gemini-2.5-flash-lite`) for auto-correction, intention detection, and keyword extraction. This incurred per-request costs and was subject to rate limits under concurrent usage.

This update replaces the cloud API with **Ollama** (local LLM server at `localhost:11434`), so all enhancement runs entirely on-device. The integration is pure HTTP — no native modules, no `electron-rebuild`, no code signing changes.

## Architecture Change

```
BEFORE:  Whisper → EnhancementService → Supabase Edge Function → Gemini API → response
AFTER:   Whisper → EnhancementService → OllamaService → localhost:11434 → response
```

**Key insight:** `TranscriptionEnhancementService` already had clean batching and event emission. Only the HTTP call layer was replaced. Everything downstream (DB updates, IPC events, UI) remains untouched.

## Implementation Summary

### New Files Created

#### 1. `apps/app/src/main/ollamaService.ts`
Core Ollama integration service:
- **Connection management**: Health check (`GET /`), periodic monitoring every 30s
- **Model management**: Pull (`POST /api/pull` with streaming progress), list (`GET /api/tags`), delete (`DELETE /api/delete`), set active model
- **Inference**: `POST /api/chat` with structured JSON output via Ollama's `format` parameter
- **Sequential queue**: Local models process one request at a time — queue prevents concurrent inference
- **Status tracking**: `'disconnected' | 'connected' | 'pulling' | 'ready' | 'error'`
- **Event emission**: `statusChanged` and `pullProgress` events forwarded to renderer
- **Retry logic**: Single retry on inference failure, 30s timeout per request
- **Singleton pattern**: `getOllamaService()` factory function

Default model: `qwen2.5:3b` (recommended — bilingual Chinese/English, good quality-to-speed ratio)

#### 2. `apps/app/src/main/localLLMPrompts.ts`
Simplified prompts adapted for local models:
- Derived from `supabase/functions/_shared/prompts.ts` (lines 622-741)
- Shorter system prompts (1-2 sentences vs paragraphs)
- Context limited to last 3 conversation entries (down from 10)
- Both `en` and `zh-TW` variants
- JSON schema for Ollama's `format` parameter guaranteeing structured output
- Same output fields: `corrected`, `translation`, `intention`, `keywords`, `confidence`

#### 3. `apps/app/src/renderer/src/components/settings/OllamaSettings.tsx`
Settings UI panel for Ollama management:
- Connection status indicator (green/red badge)
- Model selector dropdown (populated from installed models)
- "Pull Model" input with streaming progress bar
- Installed models list with size display and delete buttons
- Install Ollama link when server not detected
- Recommended model badge on `qwen2.5:3b`
- Auto-refresh on status changes via IPC event listeners

### Files Modified

#### 4. `apps/app/src/main/transcriptionEnhancementService.ts`
- **Removed**: `supabaseUrl`, `supabaseAnonKey`, `userToken`, `setUserToken()`, `callEnhancementAPI()`
- **Added**: `OllamaService` dependency in constructor, calls `ollamaService.enhance()` in `processBatch()`
- **Adjusted batching**: `maxBatchSize: 3` (from 5), `maxWaitTime: 5000ms` (from 3000ms) — local models are slower per segment
- **Added**: Ollama status check before processing — skips batch if status is not `'ready'`

#### 5. `apps/app/src/main/whisperBackend.ts`
- Changed: `setupEnhancementService(ollamaService: OllamaService)` (was `(supabaseUrl, supabaseAnonKey, userToken)`)
- Removed: `setEnhancementUserToken(token)` method entirely

#### 6. `apps/app/src/main/index.ts`
- Changed `transcription:setup-enhancement` handler: no longer takes Supabase credentials, initializes OllamaService instead
- Removed: `transcription:set-enhancement-token` IPC handler
- Added 6 new IPC handlers:
  - `ollama:get-status` — connection + model status
  - `ollama:get-models` — list installed models
  - `ollama:pull-model` — download model with streaming progress events
  - `ollama:set-model` — switch active model
  - `ollama:delete-model` — remove a model
  - `ollama:check-connection` — ping Ollama server
- Added: Ollama status change event forwarding to all BrowserWindows

#### 7. `apps/app/src/preload/index.ts`
- Added to `on` validChannels: `ollama:status-changed`, `ollama:pull-progress`
- Added to `invoke` validChannels: `ollama:get-status`, `ollama:get-models`, `ollama:pull-model`, `ollama:set-model`, `ollama:delete-model`, `ollama:check-connection`
- Removed from `invoke` validChannels: `transcription:set-enhancement-token`
- Simplified: `transcriptionSetupEnhancement()` now takes no arguments

#### 8. `apps/app/src/renderer/src/services/transcription.ts`
- Changed: `setupEnhancement()` takes no arguments (was `(supabaseUrl, supabaseAnonKey, userToken)`)
- Removed: `setEnhancementToken(token)` method

#### 9. `apps/app/src/renderer/src/hooks/useTranscriptionEnhancement.ts`
- Removed: `useAuth()` dependency, Supabase URL/key env vars, session/token checks, token refresh logic
- Simplified: calls `window.electronAPI.transcriptionSetupEnhancement()` on mount, sets up event listeners
- Returns: `{ isEnhancementReady: boolean }`

#### 10. Settings integration
- `SettingsPage.tsx`: Added `'aiModels'` section type, renders `<OllamaSettings />`
- `SettingsSidebar.tsx`: Added AI Models nav item with `Bot` icon
- `translations.ts`: Added `aiModelsTab` key (en: "AI Models", zh-TW: "AI 模型")
- `types/index.ts`: Added missing `ElectronAPI` method types (`openExternal`, `quitApp`, `toggleContentProtection`, `transcriptionSetupEnhancement`)

### Files NOT Changed
- `supabase/functions/transcription-enhance/index.ts` — Kept for potential web app use
- `supabase/functions/_shared/prompts.ts` — Kept as reference
- `supabase/functions/_shared/gemini-client.ts` — Kept for other edge functions
- All renderer components (`ChatPanel.tsx`, `RealTimeAnalysis.tsx`) — Same data flows through
- Database schema and `databaseService.ts` — Same `EnhancedSegment` format
- Audio worklets — No changes
- `IntentionProcessor` — Same event format

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| `38961b6` | Feat | Add OllamaService and local LLM prompts (2 new files) |
| `677ee88` | Refactor | Replace Supabase enhancement with local Ollama in main process (4 files) |
| `438e2f5` | Refactor | Simplify renderer enhancement to use local Ollama (3 files) |
| `6a583b9` | Feat | Add AI Models settings page for Ollama management (4 files) |

**Total**: 13 files changed (+539 lines added, -173 lines removed)

## Build Verification

Build completed successfully with `pnpm --filter Knovy build:local`:
- Vite main process: 185 modules
- Vite preload: 1 module
- Vite renderer: 2,469 modules
- electron-builder: DMG packaged

No native module changes, no `electron-rebuild` needed, no code signing updates required.

## Integration Test Results

**35/35 tests passed** against real Ollama with `gemma3:1b` model:

| Test | Result |
|------|--------|
| Ollama server connection | PASS |
| List models API | PASS (model installed, size verified) |
| English transcription correction | PASS ("mett" -> "meet", "discus" -> "discuss") |
| Chinese (zh-TW) transcription correction | PASS (valid JSON, intention detected) |
| Context-aware correction | PASS ("cash flo" -> "cash flow" using conversation context) |
| Model pull streaming API | PASS (received progress events) |
| Delete nonexistent model API | PASS (404 as expected) |
| Sequential inference (3 concurrent) | PASS (all completed, valid JSON) |

Average inference time: ~2-4 seconds per segment with `gemma3:1b` on Apple Silicon.

## Error Handling

| Scenario | Handling |
|----------|----------|
| Ollama not installed | Enhancement skipped, settings show install link |
| Ollama not running | Periodic retry (30s), status shown in settings |
| Model not pulled | Enhancement skipped until model available |
| Inference timeout (>30s) | Abort, return raw text with `confidence: 0.3` |
| Invalid JSON response | Unlikely with `format` schema; fallback to raw text |
| Ollama crashes mid-inference | Catch error, retry once, then skip segment |

Graceful degradation: raw transcription displays as-is with `enhancementStatus: 'skipped'`. The app remains fully functional.

## First-Run User Experience

1. App starts -> `OllamaService` pings `localhost:11434`
2. **If Ollama not found**: Settings shows "Ollama not detected" with install link
3. **If Ollama found but no model**: Settings shows model pull input with recommended model
4. User pulls model -> progress streams via `POST /api/pull` -> model ready
5. Enhancement begins processing -> transcriptions get corrected locally

## Recommended Models

| Model | Size | Use Case |
|-------|------|----------|
| `qwen2.5:3b` | ~1.9GB | **Recommended** — bilingual zh/en, good quality |
| `gemma3:1b` | ~815MB | Fast iteration, development/testing |
| `qwen2.5:1.5b` | ~986MB | Lower-end hardware, basic corrections |

---

*Implementation completed February 7, 2026. Status: Production-ready.*
