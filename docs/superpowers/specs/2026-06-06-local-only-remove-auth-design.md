# Design: Make Knovy Pure Local-Only (Remove Auth + Supabase)

**Date:** 2026-06-06
**Status:** Approved (design); implementation plan pending
**Branch:** `refactor/local-only`

## Goal

Strip all authentication, entitlement/quota gating, Supabase, the OAuth
`intevia://` flow, the admin dashboard, **and the marketing website** from the
Knovy monorepo. The desktop app boots straight into the main UI with every
feature unconditionally enabled, running entirely on local Whisper
(transcription) + Ollama (AI actions). The app is being open-sourced.

The marketing website (`apps/web`) is removed entirely — a new version is owned
in a **separate repository** by a collaborator, so this repo collapses to the
desktop app (+ shared packages) only.

PostHog telemetry is explicitly **deferred** to a separate future project.

## Context / Why

- All AI features already run through local Ollama via IPC (`ai:chat`,
  `ai:summarize`, …). The Supabase `ai-action-*` edge functions and the
  `services/ai-actions.ts` wrapper (`invokeAIAction`) are **dead code** — zero
  callers.
- The only thing auth still does is gate the app behind a Google login and
  toggle features via entitlements/quotas. For a local-only, open-source app
  this is pure friction.
- The desktop updater uses `electron-updater` pointed directly at GitHub
  Releases (`Intevia-AI/Knovy-Release`); it does **not** depend on the
  `get-latest-release` edge function. Removing Supabase does not break
  auto-update.
- The web app's "auth" is only the OAuth callback redirect for the desktop app
  plus an unimplemented login/register; its real Supabase use is the waitlist
  (lead-gen). Going open-source removes the need for a waitlist.

## Architecture After Change

- **Desktop**: `App.tsx` = `isUnifiedLoading ? <LoadingPage/> : <AppRouter/>`.
  No `AuthProvider`, no gate. `LoadingPage` keeps only the Whisper `model-check`
  phase. Single implicit local user; no user ids anywhere.
- **Web**: removed. The marketing site lives in a separate repo.
- **Backend**: none. `supabase/`, `apps/admin-dashboard/`, and `apps/web/`
  deleted. The monorepo is left with `apps/app` (+ `packages/*`).

## Desktop Changes (`apps/app`)

### Files deleted (100% auth/dead)
- `src/renderer/src/context/AuthContext.tsx`
- `src/renderer/src/services/supabaseClient.ts`
- `src/renderer/src/services/analytics-service.ts`
- `src/renderer/src/services/ai-actions.ts` (dead — no callers)
- `src/renderer/src/hooks/useAuth.ts`
- `src/renderer/src/components/LoginPage.tsx` (includes `Waitlist`)
- `src/renderer/src/components/settings/AccountSettings.tsx`

### Surgical edits
1. **`app/App.tsx`**: remove `AuthProvider`/`useAuth`/login/waitlist routing and
   the window-sizing branch tied to login; remove the `auth-check` loading
   phase from `createLoadingPhases()`; collapse render to
   `isUnifiedLoading ? <LoadingPage/> : <AppRouter/>`; after load, apply
   main-app window sizing (360×50, bottom-left, always-on-top) directly.
2. **`settings.tsx`**: drop the `AuthProvider` wrapper.
3. **`LoadingPage.tsx`**: rename the error-state button
   "Continue Without Offline Mode" → "Continue Without Models" (it skips the
   Whisper model download; nothing to do with accounts).
4. **Feature gates → always on**:
   - `KeywordHighlighter.tsx`, `RealTimeAnalysis.tsx`, `MarkdownRenderer.tsx`:
     remove `useAuth`/`hasEntitlement('allow_ai_action:keyword-search')`;
     `canUseKeywordSearch` becomes `true`; collapse the conditional branches.
   - `MainControlBar.tsx`: remove the `sessionProfile.entitlements` scan;
     `canShowActions` becomes `true`.
5. **History** (`components/settings/HistoryView.tsx`): remove `useAuth` and the
   `sessionProfile?.id || 'local-user'` logic; call history loaders without a
   user id. `databaseService.ts`: drop the unused `userId` param from
   `getSessionsWithTranscripts` and `getTotalSessionCount` and the
   `user_id: userId` field tacked onto results (the `sessions` table has no
   `user_id` column — no schema change, no data migration). Export locale comes
   from the local language setting / `Intl` default instead of
   `sessionProfile?.app_settings?.language`.
6. **Analytics removal**: delete the `analyticsService.incrementTranscription`
   call in `RealTimeAnalysis`; remove the analytics-session start/end/clear
   plumbing in `hooks/useScreenShare.ts` (the `user.id` "User not authenticated"
   throw is deleted with that block — screen-share proceeds with no analytics).
7. **Main process** (`main/index.ts`): remove `intevia://` protocol
   registration (`setAsDefaultProtocolClient`), the `app.on('open-url')`
   handler, the OAuth-URL forwarding and `oauthCallbackUrlOnStartup` queue
   inside `app.on('second-instance')` — **keep** the single-instance lock and
   have `second-instance` focus the existing window. Remove the `session:*`,
   `analytics:*`, `supabase:signInWithOAuth`, and `auth:*` IPC handlers and the
   `cachedSessionProfile` / `analyticsSessionId` module state.
8. **Preload** (`preload/index.ts`): remove `supabaseSignInWithOAuth` and all
   auth/session/analytics channel entries from the `validChannels` arrays
   (`on`, `send`, `invoke`) and the OAuth-callback listener channel.
9. **Types** (`renderer/src/types/index.ts`): remove `SessionProfile` and
   `supabaseSignInWithOAuth` from `ElectronAPI`.
10. **Deps/env**: remove `@supabase/supabase-js` from `apps/app/package.json`;
    strip `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from `.env` and
    `.env.example`.

## Full-Directory Deletions + Monorepo Wiring

- Delete `apps/web/` outright — the marketing site moves to a separate repo.
  This subsumes all the former web auth/waitlist/Supabase work into one deletion.
- Delete `apps/admin-dashboard/` outright (separate Next.js app; only referenced
  by deleted Supabase functions + CORS allowlist).
- Delete `supabase/` outright — all edge functions, `migrations/`,
  `config.toml`, seed, `_shared/`. No archive (git history preserves it).
- `pnpm-workspace.yaml`: remove the `supabase/functions/*` entry.
  `apps/web` and `apps/admin-dashboard` need no workspace edit (covered by the
  `apps/*` glob; Turbo discovers dynamically). After deletion the only workspace
  app is `apps/app`.
- `.github/workflows/release.yml`: remove `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` from the build env (release builds the desktop app
  only).
- Check root `package.json`, `turbo.json`, and any docs for hard references to
  `web` / `admin-dashboard` (e.g. `--filter web` scripts) and remove them.
- `pnpm-lock.yaml` regenerates as a result (approved dependency removal:
  `@supabase/supabase-js` removed with `apps/app`, `apps/web`, and
  `apps/admin-dashboard`).

## Docs

- Update `CLAUDE.md` and `docs/` to describe the local-only architecture —
  remove Supabase/auth/RBAC/admin-dashboard/edge-function/WebSocket-proxy
  references.
- Open-source `LICENSE`, `README`, and contribution guidelines are a **separate**
  future task.

## Verification

- Run `pnpm --filter app typecheck` on the affected commits. Pre-existing TS
  errors in the codebase are expected; the goal is no *new* errors from these
  changes. (`apps/web` is deleted, so there is no web typecheck.)
- No formal renderer/web test suite exists. No build or dev server run unless
  explicitly requested.
- Manual smoke (when requested): launch desktop app → boots straight to the main
  control bar after the Whisper model check; AI actions visible and working via
  Ollama; history loads; Settings has no Account section; screen-share starts
  without an auth error.

## Commit Plan (`refactor/local-only` branch)

Granular, one logical subtask per commit:

1. Desktop: remove auth gate/context/login/waitlist → boot straight to
   `AppRouter`.
2. Desktop: remove entitlement gating (features always on, no quotas).
3. Desktop: remove analytics / user-session telemetry.
4. Desktop: remove Supabase client, `intevia://` protocol, auth/session/
   analytics IPC; drop `@supabase/supabase-js` dep + env.
5. Delete `apps/web` (marketing site moves to a separate repo).
6. Delete `apps/admin-dashboard`.
7. Delete `supabase/`; fix `pnpm-workspace.yaml` + CI secrets.
8. Docs: update `CLAUDE.md` + `docs/` to local-only.

## Out of Scope

- PostHog telemetry (separate future project; clean-slate, event-based, no user
  id — will not reuse the removed `user_sessions` code).
- Open-source `LICENSE` / `README` / governance docs.
- Any rebrand: the `intevia`/`knovy` naming, `com.knovy.app` appId, and the
  `Intevia-AI/Knovy-Release` updater target stay as-is.
