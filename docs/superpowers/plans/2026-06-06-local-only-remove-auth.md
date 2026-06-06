# Local-Only (Remove Auth + Supabase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all authentication, entitlement/quota gating, Supabase, the OAuth `intevia://` flow, and the admin dashboard so the Knovy desktop app boots straight into the main UI with every feature on, running purely on local Whisper + Ollama; the website becomes static marketing.

**Architecture:** Delete the auth layer (context, client, login UI, IPC, protocol) and collapse the gate so `App.tsx` renders `LoadingPage` (Whisper model-check only) then `AppRouter`. Feature gates become unconditional `true`. Telemetry tied to `user.id`/Supabase is removed entirely (PostHog deferred). The `supabase/` backend, `apps/admin-dashboard/`, and `apps/web/` are deleted — the monorepo collapses to `apps/app` (+ `packages/*`). The marketing website moves to a separate repo owned by a collaborator.

**Tech Stack:** Electron + Vite + React 19 + TypeScript (desktop), pnpm workspaces + Turborepo. No formal test suite exists — verification is `pnpm --filter app typecheck` (no *new* errors) plus targeted `grep` proving references are gone.

**Branch:** `refactor/local-only` (already created; design spec committed at `docs/superpowers/specs/2026-06-06-local-only-remove-auth-design.md`).

**Spec reference:** `docs/superpowers/specs/2026-06-06-local-only-remove-auth-design.md`

---

## Conventions for this plan

- There is no unit-test harness. Each task's "verify" step is a **typecheck** of the affected app plus a **grep** that the removed symbols/channels no longer appear (outside generated `.next/`/`out/` build dirs).
- Pre-existing TypeScript errors exist in the codebase. "Typecheck passes" means **no new errors are introduced by this task** — compare against the error set before editing if unsure.
- Commit messages follow the repo convention `{Type}: {Description}` and **must not** include `Co-Authored-By` lines.
- Do not run `pnpm dev`/`build` or launch the app unless the user asks.

---

## Task 1: Desktop — remove auth gate, boot straight to AppRouter

Removes the login/waitlist gate and the `auth-check` loading phase. After this task the app shows `LoadingPage` (Whisper model-check) then `AppRouter` with no login screen.

**Files:**
- Delete: `apps/app/src/renderer/src/context/AuthContext.tsx`
- Delete: `apps/app/src/renderer/src/hooks/useAuth.ts`
- Delete: `apps/app/src/renderer/src/components/LoginPage.tsx` (contains `LoginPage` + `Waitlist`)
- Modify: `apps/app/src/renderer/src/app/App.tsx`
- Modify: `apps/app/src/renderer/src/settings.tsx`

- [ ] **Step 1: Capture the current typecheck baseline**

Run: `pnpm --filter app typecheck 2>&1 | tee /tmp/tc-before.txt | tail -5`
Note the error count; this is the pre-existing baseline to compare against.

- [ ] **Step 2: Rewrite `App.tsx` to remove the gate**

In `apps/app/src/renderer/src/app/App.tsx`:

1. Remove the auth imports and the `LoadingPage` auth phase. Delete these imports:
```ts
import { useAuth } from '@/hooks/useAuth'        // wherever it appears
import { AuthProvider } from '../context/AuthContext'
import { LoginPage, Waitlist } from '../components/LoginPage'  // or whatever the exact import lines are
```
(Keep the `LoadingPage`, `AppRouter`, `getWhisperClient`, motion imports.)

2. In `AppContent()`, replace the `useAuth()` line:
```ts
const { user, isLoading, sessionProfile } = useAuth()
```
with local state only — there is no auth now:
```ts
const [isLoading] = useState(false)
```
(Keep `isInitialLoad`, `isUnifiedLoading`, `hash`, `isPopover`, the resize logic.)

3. In the window-sizing `useEffect`, replace the `isUserLoggedIn`/`isWaitlisted` branch logic so the **main-app sizing always applies** after loading. Replace the body that currently reads:
```ts
const isUserLoggedIn = user && sessionProfile
const isWaitlisted = isUserLoggedIn && sessionProfile.role === 'free' && ...
if (isUnifiedLoading) { return }
if (isUserLoggedIn && !isWaitlisted) {
  if (!hasBeenPositioned) { debouncedWindowResize(360, 50, 'bottom-left', true); setHasBeenPositioned(true) }
} else {
  debouncedWindowResize(320, 300, 'center', false)
  if (hasBeenPositioned) setHasBeenPositioned(false)
}
```
with:
```ts
if (isUnifiedLoading) { return }
if (!hasBeenPositioned) {
  debouncedWindowResize(360, 50, 'bottom-left', true)
  setHasBeenPositioned(true)
}
```
Remove `user`, `sessionProfile` from that effect's dependency array.

4. In `createLoadingPhases()`, delete the entire `auth-check` phase object (the second array element with `name: 'auth-check'`). Keep only the `model-check` phase. (It will no longer reference `isLoading`, `user`, or `sessionProfile`.)

5. Replace the render's content branch. The current render is:
```tsx
{isUnifiedLoading && !isPopover ? (
  <motion.div key="unified-loading" ...><LoadingPage .../></motion.div>
) : (
  <div key="content">
    <AnimatePresence mode="wait">
      {user && sessionProfile ? (
        ... waitlist ternary ... <AppRouter /> ...
      ) : (
        <motion.div key="login" ...><LoginPage /></motion.div>
      )}
    </AnimatePresence>
  </div>
)}
```
Replace the entire `:` (else) block so it renders `AppRouter` directly:
```tsx
) : (
  <motion.div
    key="main"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
  >
    <AppRouter />
  </motion.div>
)}
```

6. At the bottom `export default function App()`, remove the `<AuthProvider>` wrapper around `<AppContent />` (keep any `TranslationProvider`/`ThemeProvider` wrappers). For example change:
```tsx
<AuthProvider>
  <AppContent />
</AuthProvider>
```
to:
```tsx
<AppContent />
```

- [ ] **Step 3: Remove `AuthProvider` from `settings.tsx`**

In `apps/app/src/renderer/src/settings.tsx`, delete the import line `import { AuthProvider } from './context/AuthContext'` and unwrap it:
```tsx
ReactDOM.createRoot(document.getElementById('settings-root')!).render(
  <React.StrictMode>
    <TranslationProvider>
      <SettingsWindow />
    </TranslationProvider>
  </React.StrictMode>
)
```

- [ ] **Step 4: Delete the auth files**

Run:
```bash
git rm apps/app/src/renderer/src/context/AuthContext.tsx \
       apps/app/src/renderer/src/hooks/useAuth.ts \
       apps/app/src/renderer/src/components/LoginPage.tsx
```

- [ ] **Step 5: Verify typecheck has no NEW errors and the gate is gone**

Run:
```bash
pnpm --filter app typecheck 2>&1 | tail -20
grep -rn "useAuth\|AuthProvider\|LoginPage\|Waitlist" apps/app/src/renderer/src/app/App.tsx apps/app/src/renderer/src/settings.tsx
```
Expected: typecheck shows no new errors referencing `App.tsx`/`settings.tsx`; the grep returns nothing. (Other components still import `useAuth` — they are fixed in Tasks 2–3. If typecheck flags those files, that is expected until then.)

> NOTE: Tasks 1–3 collectively remove every `useAuth` consumer. Because deleting `useAuth.ts` in Step 4 breaks the other importers until Task 2/3, run the **full** desktop typecheck only at the end of Task 3. Within Task 1, confirm `App.tsx`/`settings.tsx` themselves are clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Refactor(app): Remove auth gate, boot straight to AppRouter"
```

---

## Task 2: Desktop — make feature gates unconditional (no entitlements/quotas)

Removes every `hasEntitlement`/`sessionProfile.entitlements` check so all AI features are always enabled.

**Files:**
- Modify: `apps/app/src/renderer/src/components/KeywordHighlighter.tsx`
- Modify: `apps/app/src/renderer/src/components/MarkdownRenderer.tsx`
- Modify: `apps/app/src/renderer/src/components/MainControlBar.tsx`
- Modify: `apps/app/src/renderer/src/components/RealTimeAnalysis.tsx` (entitlement part only; analytics removed in Task 3)

- [ ] **Step 1: `KeywordHighlighter.tsx` — always clickable**

Remove the import `import { useAuth } from '@/hooks/useAuth'` (line 3). Replace:
```ts
const { hasEntitlement } = useAuth()
const canUseKeywordSearch = hasEntitlement('allow_ai_action:keyword-search')
```
with:
```ts
const canUseKeywordSearch = true
```
Leave the usages at lines 91/102 (`canUseKeywordSearch && onKeywordClick`) untouched — they now resolve on `onKeywordClick` alone.

- [ ] **Step 2: `MarkdownRenderer.tsx` — always clickable**

Remove the import `import { useAuth } from '@/hooks/useAuth'` (line 9). Replace:
```ts
const { hasEntitlement } = useAuth()
const canUseKeywordSearch = hasEntitlement('allow_ai_action:keyword-search')
```
with:
```ts
const canUseKeywordSearch = true
```

- [ ] **Step 3: `MainControlBar.tsx` — always show actions**

Remove the import `import { useAuth } from '@/hooks/useAuth'` (line 13). Replace the block at lines 39–46:
```ts
const { sessionProfile } = useAuth()

// Check if any AI action entitlements are enabled in the session profile
const canShowActions =
  sessionProfile?.entitlements &&
  Object.keys(sessionProfile.entitlements).some(
    (key) => key.startsWith('allow_ai_action:') && sessionProfile.entitlements[key] === true
  )
```
with:
```ts
const canShowActions = true
```
Leave the usage at line 101 (`{canShowActions && (`) untouched.

- [ ] **Step 4: `RealTimeAnalysis.tsx` — drop the entitlement read**

At line 35 replace:
```ts
const { hasEntitlement, sessionProfile } = useAuth()
const canUseKeywordSearch = hasEntitlement('allow_ai_action:keyword-search')
```
with:
```ts
const canUseKeywordSearch = true
```
Do **not** remove the `useAuth` import line yet if it is shared — but in this file `useAuth` is only used here, so remove `import { useAuth } from '@/hooks/useAuth'` (line 8). (The `analyticsService` import on line 11 and `incrementTranscription` are handled in Task 3.) Leave the usages at lines 316/328 (`canUseKeywordSearch`) untouched.

- [ ] **Step 5: Verify the entitlement surface is gone**

Run:
```bash
grep -rn "hasEntitlement\|allow_ai_action\|sessionProfile" apps/app/src/renderer/src/components/KeywordHighlighter.tsx apps/app/src/renderer/src/components/MarkdownRenderer.tsx apps/app/src/renderer/src/components/MainControlBar.tsx apps/app/src/renderer/src/components/RealTimeAnalysis.tsx
```
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Refactor(app): Enable all AI features unconditionally, drop entitlement gating"
```

---

## Task 3: Desktop — remove analytics / user-session telemetry

Deletes the Supabase-backed analytics service and all `user.id`/`analytics:*` plumbing. Fixes the screen-share `user.id` throw by removing the analytics block.

**Files:**
- Delete: `apps/app/src/renderer/src/services/analytics-service.ts`
- Modify: `apps/app/src/renderer/src/hooks/useScreenShare.ts`
- Modify: `apps/app/src/renderer/src/components/RealTimeAnalysis.tsx`

- [ ] **Step 1: `useScreenShare.ts` — remove analytics + auth**

1. Delete imports:
```ts
import { analyticsService } from '@/services/analytics-service'
import { useAuth } from '@/context/AuthContext'
```
2. Delete the `const { user } = useAuth()` line (line 53).
3. Delete the end-session analytics block (lines ~118–130):
```ts
// End analytics session for this screen-share session
if (analyticsService.isSessionActive()) {
  console.log('[ScreenShare] Ending analytics session')
  await analyticsService.endSession('normal')
  console.log('[ScreenShare] Analytics session ended')

  // Clear analytics session ID in main process
  if ((window as any).electronAPI) {
    await (window as any).electronAPI.invoke('analytics:clear-session-id')
    console.log('[ScreenShare] Cleared analytics session ID in main process')
  }
}
```
4. Delete the start-session analytics block (lines ~329–343), i.e. everything from the comment `// Start analytics session for this screen-share session` through the `analytics:set-session-id` invoke, so the flow goes directly from `getDisplayMedia(...)` to `await startMicRecording()`. Remove:
```ts
// Start analytics session for this screen-share session
if (!user?.id) {
  console.error('[ScreenShare] Cannot start analytics session: No user ID')
  throw new Error('User not authenticated')
}

console.log('[ScreenShare] Starting analytics session for user:', user.id)
const sessionId = await analyticsService.startSession(user.id)
console.log('[ScreenShare] Analytics session started:', sessionId)

// Send analytics session ID to main process for transcription enhancement
if ((window as any).electronAPI) {
  await (window as any).electronAPI.invoke('analytics:set-session-id', sessionId)
  console.log('[ScreenShare] Sent analytics session ID to main process:', sessionId)
}
```

- [ ] **Step 2: `RealTimeAnalysis.tsx` — remove transcription analytics**

1. Delete the import `import { analyticsService } from '@/services/analytics-service'` (line 11).
2. Delete the analytics block inside the cleanup effect (lines ~555–565):
```ts
// Analytics: Track transcription session end
if (transcriptionStartTimeRef.current) {
  const durationMs = Date.now() - transcriptionStartTimeRef.current
  const durationMinutes = durationMs / 1000 / 60

  console.log(`[Analytics] Transcription session ended: ${durationMinutes.toFixed(2)} minutes`)

  // Update aggregated session metrics
  analyticsService.incrementTranscription(durationMinutes)

  // Reset tracking ref
  transcriptionStartTimeRef.current = null
}
```
3. Search the file for other `transcriptionStartTimeRef` usages: `grep -n "transcriptionStartTimeRef" apps/app/src/renderer/src/components/RealTimeAnalysis.tsx`. If the ref is now unused everywhere, delete its declaration too; if it is still set elsewhere for non-analytics reasons, leave the declaration and only remove the analytics consumer above.

- [ ] **Step 3: Delete the analytics service**

```bash
git rm apps/app/src/renderer/src/services/analytics-service.ts
```

- [ ] **Step 4: Full desktop typecheck — Tasks 1–3 complete the renderer auth removal**

Run:
```bash
pnpm --filter app typecheck 2>&1 | tail -30
grep -rn "useAuth\|analytics-service\|analyticsService\|hasEntitlement" apps/app/src/renderer/src --include="*.ts*"
```
Expected: the grep returns nothing (every renderer auth/analytics reference is gone). Typecheck shows no NEW errors versus `/tmp/tc-before.txt` from Task 1 (the `session:*`/`analytics:*` IPC channels still exist in preload/main — removed in Task 4 — but renderer no longer calls them; `electronAPI.invoke('analytics:...')` calls are deleted).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Refactor(app): Remove user-session analytics telemetry"
```

---

## Task 4: Desktop — remove Supabase client, protocol, IPC, dep + env

Strips the Supabase client, the `intevia://` OAuth protocol, all auth/session/analytics IPC, and the dependency. Keeps the single-instance lock (window focus).

**Files:**
- Delete: `apps/app/src/renderer/src/services/supabaseClient.ts`
- Delete: `apps/app/src/renderer/src/services/ai-actions.ts` (dead code, no callers)
- Modify: `apps/app/src/main/index.ts`
- Modify: `apps/app/src/preload/index.ts`
- Modify: `apps/app/src/renderer/src/types/index.ts`
- Modify: `apps/app/package.json`
- Modify: `apps/app/.env.example` (and `.env` if present locally)

- [ ] **Step 1: Delete dead Supabase-coupled services**

```bash
git rm apps/app/src/renderer/src/services/supabaseClient.ts \
       apps/app/src/renderer/src/services/ai-actions.ts
```

- [ ] **Step 2: `main/index.ts` — remove protocol + OAuth, keep single-instance focus**

1. Remove the protocol constant and registration. Delete `const PROTOCOL = 'intevia'` (line ~522) and both `app.setAsDefaultProtocolClient(PROTOCOL)` calls (lines ~832, ~835).
2. Delete the `app.on('open-url', ...)` handler (lines ~559–570) entirely.
3. In the `app.on('second-instance', ...)` handler (lines ~530–556), remove the OAuth-URL parsing/forwarding (the `commandLine.find(arg => arg.startsWith(\`${PROTOCOL}://\`))` block and the `mainWindow.webContents.send('electronAPI:oauth-callback', url)` call). **Keep** the part that focuses/restores the existing window. If after removal the handler only focused the window via the removed branch, replace the body with:
```ts
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})
```
4. Delete the `ipcMain.on('renderer-auth-ready', ...)` handler (lines ~572–577) and the `oauthCallbackUrlOnStartup` variable + every reference to it.
5. Delete the session-profile IPC handlers (lines ~349–386): `ipcMain.handle('session:get-profile', ...)`, `ipcMain.handle('session:set-profile', ...)`, `ipcMain.handle('session:clear-profile', ...)`, and the `let cachedSessionProfile: any | null = null` declaration (line ~61).
6. Delete the analytics IPC handlers (lines ~389–447): `ipcMain.handle('analytics:set-session-id', ...)`, `analytics:get-session-id`, `analytics:clear-session-id`, and the `let analyticsSessionId: string | null = null` declaration (line ~63). Search for any other `analyticsSessionId` reads (lines ~1553, ~2126 per the map) and remove/neutralize them — if a transcription-enhancement call passed `analyticsSessionId`, drop that argument.
7. Delete the OAuth/sign-out IPC handlers (lines ~1012–1024): `ipcMain.handle('supabase:signInWithOAuth', ...)` and `ipcMain.on('auth:request-sign-out', ...)`.
8. Remove the `electron-updater` import? **No** — keep it (updater stays). Only remove auth/Supabase code.

After editing, confirm no dangling references:
```bash
grep -n "PROTOCOL\|oauth\|OAuth\|session:get-profile\|session:set-profile\|session:clear-profile\|analytics:set-session-id\|analytics:get-session-id\|analytics:clear-session-id\|supabase:signInWithOAuth\|auth:request-sign-out\|renderer-auth-ready\|cachedSessionProfile\|analyticsSessionId\|oauthCallbackUrlOnStartup" apps/app/src/main/index.ts
```
Expected: no matches.

- [ ] **Step 3: `preload/index.ts` — remove auth/session/analytics channels**

1. Remove the `supabaseSignInWithOAuth` method (line ~8 declaration + its `invoke('supabase:signInWithOAuth', ...)` at line ~251).
2. From the `validChannels` arrays, remove these entries:
   - **on/listen** (line ~147,155,158): `'electronAPI:oauth-callback'`, `'analytics:session-id-changed'`, `'auth:execute-sign-out'`
   - **send** (line ~211,223): `'renderer-auth-ready'`, `'auth:request-sign-out'`
   - **invoke** (line ~271–276): `'session:get-profile'`, `'session:set-profile'`, `'session:clear-profile'`, `'analytics:set-session-id'`, `'analytics:get-session-id'`, `'analytics:clear-session-id'`

Confirm:
```bash
grep -n "oauth\|auth:\|session:get-profile\|session:set-profile\|session:clear-profile\|analytics:\|supabaseSignInWithOAuth\|renderer-auth-ready" apps/app/src/preload/index.ts
```
Expected: no matches (note: a `session:get-id` channel for the **local transcription** session is unrelated — keep any `session:get-id`/`session:create`/`session:end` style channels; only remove `session:get-profile|set-profile|clear-profile`).

- [ ] **Step 4: `types/index.ts` — drop auth types**

Remove the `SessionProfile` interface (lines ~6–12) and the `supabaseSignInWithOAuth: (data: { urlToOpen: string }) => Promise<void>` member from the `ElectronAPI` interface (line ~36).

- [ ] **Step 5: Remove the dependency + env**

1. In `apps/app/package.json`, delete the line `"@supabase/supabase-js": "^2.49.4",` from `dependencies`.
2. In `apps/app/.env.example`, delete the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` lines (and any Supabase comment block). Do the same in `apps/app/.env` if it exists locally.
3. Reinstall to update the lockfile:
```bash
pnpm install
```
Expected: `pnpm-lock.yaml` updates, `@supabase/supabase-js` removed from the app's resolution.

- [ ] **Step 6: Verify**

```bash
pnpm --filter app typecheck 2>&1 | tail -30
grep -rn "supabase\|@supabase\|VITE_SUPABASE" apps/app/src apps/app/package.json apps/app/.env.example
```
Expected: no `supabase` references remain in `apps/app`; typecheck shows no new errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Refactor(app): Remove Supabase client, intevia:// protocol, auth/session/analytics IPC"
```

---

## Task 5: Delete the marketing website (`apps/web`)

The marketing site is moving to a separate repository owned by a collaborator,
so the entire app is removed from this monorepo (this subsumes all former
web auth/waitlist/Supabase stripping into one deletion).

**Files:**
- Delete: `apps/web/` (entire directory)
- Modify (only if a hard reference exists): root `package.json`, `turbo.json`

- [ ] **Step 1: Check for hard references to `web` before deleting**

```bash
grep -rn "apps/web\|--filter web\|\"web\"" package.json turbo.json pnpm-workspace.yaml .github/workflows/ | grep -v node_modules
```
Note any `--filter web` script or pipeline entry to remove in Step 3.

- [ ] **Step 2: Delete the app**

```bash
git rm -r apps/web
```

- [ ] **Step 3: Remove any hard references found in Step 1**

If root `package.json` has a script like `"dev:web": "pnpm --filter web dev"` or similar, delete that script. `pnpm-workspace.yaml` needs no edit (`apps/web` is covered by the `apps/*` glob, and the glob matching a now-absent dir is fine). `turbo.json` uses task names, not app names — no edit needed unless it explicitly scopes `web`.

- [ ] **Step 4: Reinstall + verify**

```bash
pnpm install
grep -rn "apps/web\|--filter web" . --include="*.json" --include="*.yaml" --include="*.yml" | grep -v node_modules | grep -v "/.next/"
```
Expected: `pnpm install` succeeds; no remaining hard references to `apps/web` (docs are handled in Task 8).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Chore: Remove marketing website (moved to separate repo)"
```

---

## Task 6: Delete the admin dashboard

**Files:**
- Delete: `apps/admin-dashboard/` (entire directory)

- [ ] **Step 1: Delete the app**

```bash
git rm -r apps/admin-dashboard
```

- [ ] **Step 2: Verify nothing else references it**

```bash
grep -rn "admin-dashboard" . --include="*.json" --include="*.yaml" --include="*.yml" --include="*.ts" --include="*.md" | grep -v node_modules | grep -v "/.next/"
```
Expected: only matches inside `supabase/_shared/cors.ts` (deleted next task) and docs (updated in Task 8). No `package.json`/`pnpm-workspace.yaml`/`turbo.json` hard reference (it is covered by the `apps/*` glob).

- [ ] **Step 3: Reinstall + commit**

```bash
pnpm install
git add -A
git commit -m "Chore: Remove admin-dashboard app"
```

---

## Task 7: Delete supabase/, fix workspace + CI

**Files:**
- Delete: `supabase/` (entire directory)
- Modify: `pnpm-workspace.yaml`
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Delete the backend**

```bash
git rm -r supabase
```

- [ ] **Step 2: `pnpm-workspace.yaml` — remove the functions entry**

Remove the `- "supabase/functions/*"` line. Result:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: `.github/workflows/release.yml` — drop Supabase secrets**

Remove the two env lines (around lines 59–60):
```yaml
VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```
Leave the rest of the build/signing env intact.

- [ ] **Step 4: Verify + reinstall**

```bash
grep -rn "supabase\|VITE_SUPABASE" pnpm-workspace.yaml .github/workflows/release.yml turbo.json
pnpm install
pnpm --filter app typecheck 2>&1 | tail -5
pnpm --filter web typecheck 2>&1 | tail -5
```
Expected: no Supabase references in workspace/CI; both typechecks show no new errors; `pnpm install` succeeds with the trimmed workspace.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Chore: Remove supabase backend, fix workspace and release CI"
```

---

## Task 8: Docs — update CLAUDE.md + docs/ to local-only

**Files:**
- Modify: `CLAUDE.md` (project root — `/Users/tweizh/DEV/Intevia/Knovy/CLAUDE.md`)
- Modify: relevant files under `docs/`

- [ ] **Step 1: Inventory stale references**

```bash
grep -rn "Supabase\|supabase\|Auth\|RBAC\|entitlement\|quota\|admin dashboard\|admin-dashboard\|edge function\|Edge Function\|WebSocket proxy\|proxy server\|OAuth\|intevia://" CLAUDE.md docs/ | grep -v "/superpowers/"
```
Build a list of every claim to correct.

- [ ] **Step 2: Edit `CLAUDE.md`**

Update the Architecture/Backend/Auth sections to describe the local-only reality:
- Remove the "Backend: Supabase (PostgreSQL, Auth, Edge Functions)" / "Node.js WebSocket proxy server" claims.
- Remove the "Authentication & RBAC" section (Supabase Auth, OAuth, entitlements/quotas, `get-session-profile`, admin dashboard restriction).
- Remove `apps/admin-dashboard/`, `apps/web/`, and `supabase/` from the project-structure tree; the tree should show `apps/app` (+ `app_old` if kept) and `packages/*` only.
- Remove the "Web Application (`apps/web`)" command block and the "Supabase Development" commands block + Supabase steps in "Environment Setup"/"Development Workflow". Note the marketing site now lives in a separate repo. **Keep** the History Viewer (`apps/history-viewer`) section — it is embedded in the desktop app and is not being removed.
- State that the app is local-only: transcription via local Whisper, all AI via local Ollama (`localhost:11434`), no accounts, no backend. Note PostHog telemetry is planned (not yet implemented).
- Keep desktop architecture, audio pipeline, release process (GitHub Releases via electron-updater), and the agent-system sections that are still accurate.

- [ ] **Step 3: Edit `docs/`**

For each stale file found in Step 1 (outside `docs/superpowers/`), correct or remove the Supabase/auth/admin/proxy content. If a doc is *entirely* about the removed backend (e.g. a Supabase/auth architecture doc), `git rm` it. Do not touch `docs/superpowers/specs/` or `docs/superpowers/plans/` (this work's own artifacts).

- [ ] **Step 4: Verify**

```bash
grep -rn "Supabase\|RBAC\|entitlement\|admin-dashboard\|get-session-profile\|intevia://\|WebSocket proxy" CLAUDE.md docs/ | grep -v "/superpowers/"
```
Expected: no remaining stale references (or only intentional historical mentions clearly marked as removed).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Docs: Update CLAUDE.md and docs to local-only architecture"
```

---

## Final verification (after all tasks)

- [ ] `pnpm install` succeeds from a clean state; the only workspace app left is `apps/app`.
- [ ] `pnpm --filter app typecheck` shows no errors introduced by this work (compare to the Task 1 baseline).
- [ ] `grep -rn "@supabase\|supabaseClient\|hasEntitlement\|sessionProfile\|intevia://\|analytics-service" apps packages --include="*.ts*" | grep -v "/.next/" | grep -v "/out/"` returns nothing.
- [ ] `apps/web` and `apps/admin-dashboard` no longer exist; `ls apps/` shows only `app` (and `app_old` if still present).
- [ ] Manual smoke (only if the user asks to run it): desktop app launches → after the Whisper model-check it goes straight to the main control bar (no login); the actions panel and keyword search are available; AI actions work via Ollama; Settings has History/General/AI Models/Auto-Trigger/Shortcuts/About but **no Account**; starting screen-share does not throw "User not authenticated"; history loads.

## Self-review notes (author)

- **Spec coverage:** Tasks map 1:1 to the spec's 8-commit plan. Desktop deletions (AuthContext, supabaseClient, analytics-service, ai-actions, useAuth, LoginPage, AccountSettings) are all covered (AccountSettings removal is folded into Task 2's settings edits below — see addendum). Web, admin, supabase, wiring, docs all covered.
- **Addendum — AccountSettings / SettingsPage / sidebar** (belongs with Task 2, add as Task 2 Step 4b): delete `apps/app/src/renderer/src/components/settings/AccountSettings.tsx`; in `SettingsPage.tsx` remove the `AccountSettings` import (line 7), the `useAuth` import (line 12) + `const { sessionProfile } = useAuth()` (line 18), the `'account'` member of the `SettingsSection` union (line 14), and the `account: <AccountSettings .../>` entry (line 37); in `SettingsSidebar.tsx` remove the `{ id: 'account', labelKey: 'accountTab', icon: User }` nav item (line 32) and the now-unused `User` icon import; optionally remove the `accountTab` keys from `lib/translations.ts` (lines 109, 301, 495) — leaving them is harmless, removing them is cleaner. Verify: `grep -rn "AccountSettings\|accountTab\|'account'" apps/app/src/renderer/src` returns nothing (or only the translations if you chose to keep them).
- **HistoryView user-scoping** (belongs with Task 3, add as Task 3 Step 2b): in `HistoryView.tsx` remove `useAuth`/`sessionProfile`; replace the `sessionProfile?.id`-driven `useEffect` (lines 48–57) with a one-time load (`useEffect(() => { loadSessions(0, true) }, [])`), and replace `const userId = sessionProfile?.id || 'local-user'` (line 156) by calling `window.electronAPI.getSessionsWithTranscripts(SESSIONS_PER_PAGE, currentOffset)` without a user id; for export locale (line 197) replace `sessionProfile?.profile?.language || sessionProfile?.app_settings?.language || 'en-US'` with the app's local language (from `useI18n`/`TranslationContext`) or `Intl.DateTimeFormat().resolvedOptions().locale`. In `apps/app/src/main/databaseService.ts` drop the unused `userId` param from `getSessionsWithTranscripts` (line 339) and `getTotalSessionCount` (line 388) and the `user_id: userId` field on results (line 378); update the preload bridge + `main/index.ts` IPC handler signatures for `getSessionsWithTranscripts`/`getTotalSessionCount` to match. Verify the renderer + main agree on the new signature via `pnpm --filter app typecheck`.

> The two addenda above are folded into Tasks 2 and 3 respectively at execution time; they are listed here so no spec requirement is dropped. An executor should treat "Task 2" as including the AccountSettings addendum and "Task 3" as including the HistoryView addendum.
