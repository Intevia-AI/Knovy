# Flatten Monorepo → Single-Package Repo

**Date:** 2026-06-07
**Status:** Approved design, pending implementation plan
**Branch target:** feature branch off `dev`, one PR, granular commits

## Problem

After the local-only migration (PR #18) removed `apps/web` and `apps/admin-dashboard`, and
the earlier removal of `apps/history-viewer`, the repository still carries a full monorepo
scaffold (`apps/*` + `packages/*` workspaces, Turborepo) for what is now a **single
application**: `apps/app` (Knovy). The `apps/` directory has exactly one child, and two of
the three shared `packages/*` are dead. Docs still describe the removed apps.

Goal: dissolve the monorepo into a single-package repository whose root **is** the Knovy
Electron app, and bring the docs in line.

## Current state (verified)

- `apps/app` — **Knovy** v0.3.9, the only app. `history-viewer` is entirely absent from the repo.
- `packages/ui` (`@workspace/ui`) — **orphaned**: appears in zero `dependencies` anywhere
  (only its own `name`, self-imports, one historical plan doc). Was consumed by the removed
  web/admin apps.
- `packages/eslint-config` (`@workspace/eslint-config`), `packages/typescript-config`
  (`@workspace/typescript-config`) — consumed **only at the repo root**
  (`.eslintrc.js`, root `tsconfig.json`). The root eslint config explicitly ignores
  `apps/**` and `packages/**`, so it only ever linted root-level tooling files.
- `apps/app`'s **own** `eslint.config.mjs` and tsconfigs extend `@electron-toolkit/*`, **not**
  the `@workspace/*` packages. The app already lints/typechecks self-contained; its declared
  `@workspace/*` devDeps are dead weight.
- `turbo` — referenced only by root config + the packages being deleted.
- `concurrently` — only in root devDeps + stale docs (it ran history-viewer, now gone).

## Target end state

```
/
├── src/                    (was apps/app/src)
├── resources/  code-signing/  build/
├── electron.vite.config.ts  electron-builder.yml  entitlements.mac.plist
├── tailwind.config.ts  postcss.config.mjs  components.json  eslint.config.mjs
├── tsconfig.json  tsconfig.node.json  tsconfig.web.json
├── package.json            (merged: Knovy app + root-only bits)
├── tests/                  (app tests + consolidated release-config test)
├── docs/  plans/  scripts/  types/  .github/
├── .gitignore  .prettierrc.yaml  .editorconfig  .npmrc  dev-app-update.yml
└── README.md  CONTRIBUTING.md  CLAUDE.md
```

Removed: `apps/`, `packages/`, `pnpm-workspace.yaml`, `turbo.json`, root `.eslintrc.js`,
root `tsconfig.json`, root `test/` (consolidated into `tests/`).

## Operations

### 1. Move `apps/app/*` → repo root

Use `git mv` to preserve history. Move all of `apps/app`'s tracked contents to root,
including dotfiles (`.editorconfig`, `.npmrc`, `.prettierignore`, `.prettierrc.yaml`,
`.env.example`, etc.) and dirs (`src/`, `resources/`, `code-signing/`, `build/`, `tests/`).

**Collision resolution (root ← app):**

| File | Resolution |
|------|-----------|
| `package.json` | **Merge** (§3) |
| `tsconfig.json` | App's (references-based) wins; root's `@workspace`-extending one deleted |
| `.gitignore` | **Union**, root-relative (§5) |
| `.prettierrc.yaml` | **App's wins** (no-semi/single-quote governs the bulk of the code; root's semi/double-quote style would force a mass reformat of app source) |
| `README.md` | Keep **root's** as canonical repo front page; fold in anything unique from app's; delete app's |

### 2. Delete dead workspace scaffold

- `packages/ui` (orphaned)
- `packages/eslint-config`, `packages/typescript-config` (root-only consumers removed in this change)
- `pnpm-workspace.yaml`
- `turbo.json`
- root `.eslintrc.js` (only linted root tooling; the app's `eslint.config.mjs` now covers root)
- root `tsconfig.json` (extended the deleted `@workspace/typescript-config`)

### 3. Merge `package.json` → single file

Base = the Knovy app `package.json` (keep `name: "Knovy"`, `productName`, all app
`scripts`, `dependencies`, full electron-builder devDeps, `main`, `type`, `postinstall`,
repo metadata).

**Add from root package.json:**
- scripts: `test` (`vitest`), `test:run` (`vitest run`), `format` (prettier)
- devDeps: `vitest`, `js-yaml`, `@types/js-yaml`, `prettier`
- `pnpm.onlyBuiltDependencies`
- `packageManager` (`pnpm@10.4.1`), `engines` (`node >=20`)

**Drop:**
- devDeps: `@workspace/eslint-config`, `@workspace/typescript-config`, `turbo`, `concurrently`
- root `build` / `dev` / `lint` turbo scripts (the app's own `dev`/`build` scripts replace them)
- root deps `@eslint/js`, `typescript-eslint` **if** unused after `.eslintrc.js` deletion
  (verify during implementation; they backed the deleted root eslint config)

**No dependency version changes** — only which file the entries live in.

### 4. Rewrite pipeline path references

- `.github/workflows/release.yml`:
  - `require('./apps/app/package.json').version` → `require('./package.json').version`
  - `pnpm --filter Knovy run build:ci` → `pnpm run build:ci`
  - error message string `apps/app/package.json` → `package.json`
- `.github/workflows/staging.yml`:
  - remove `working-directory: apps/app` from the version-suffix step
  - `pnpm --filter Knovy run build:staging` → `pnpm run build:staging`
  - artifact paths `apps/app/dist/*.dmg` / `*.zip` → `dist/*.dmg` / `*.zip`
- `tests/release-config.test.ts` (after consolidation, §6):
  - `readYaml('apps/app/electron-builder.yml')` → `readYaml('electron-builder.yml')`
  - `.github/workflows/release.yml` path unchanged (workflows stay at root)

### 5. Merge `.gitignore`

Union of root + app `.gitignore`, then:
- strip `apps/app/` prefixes → root-relative (`apps/app/public/history` → `public/history`,
  `apps/app/resources/whisper.cpp/models/` → `resources/whisper.cpp/models/`)
- drop dead entries: `apps/app_old/...`, `supabase/...`
- keep app entries (`out`, `dist`, `.eslintcache`, `src/renderer/public/history`,
  `certificate.p12`, `build-mac-signed.sh`, `.env.development`, `.env.production`)
- keep `.turbo` removal? `.turbo` dirs are gone after dissolve — entry can be dropped, harmless to keep.

### 6. Consolidate tests

Move `test/release-config.test.ts` → `tests/release-config.test.ts` (app's test dir), delete
the now-empty root `test/`. One vitest run covers all tests from root.

### 7. Regenerate `pnpm-lock.yaml`

Run `pnpm install` to rebuild the lockfile for the single-package layout. Dependency
versions are unchanged. **Must succeed before push** or CI `--frozen-lockfile` fails.
(Decision: implementer runs `pnpm install`.)

### 8. Update docs

- `CLAUDE.md`: remove the monorepo/Turborepo/workspace sections, the `apps/` + `packages/`
  tree diagram, `apps/history-viewer` references, `pnpm --filter` commands; rewrite the
  Project Structure and Development Commands sections for a single-package root layout.
- `README.md`: update structure/setup/commands to single-package.
- `CONTRIBUTING.md`: update any structure or `--filter` references.

## Risks & mitigations

- **Release pipeline is the blast radius.** A wrong path silently breaks tag→build→publish.
  Mitigations: `tests/release-config.test.ts` runs in `staging.yml`; a final repo-wide grep
  sweep for residual `apps/app`, `--filter`, `packages/`, `@workspace/`, `turbo`.
- **electron-builder relative paths** (`./code-signing/*`, icon `src/renderer/public/...`,
  `entitlements.mac.plist`) stay valid because those files move to root alongside the config.
- **Lockfile regen** must complete before pushing.
- **Prettier config switch** for root tooling files: `test/`, `scripts/`, `types/` were
  authored under root's semi/double-quote style; under the app's config they may report as
  unformatted. Acceptable (tiny surface); optionally run `pnpm format` once post-move.

## Out of scope

- No dependency upgrades or additions.
- No source-code refactoring inside `src/`.
- Graphify artifacts (`graphify-out/`, `deno.lock`, `.prompts_*.md`), `docs/`, `plans/`
  content unchanged except the doc updates in §8.

## Verification (post-implementation)

1. `pnpm install` succeeds; lockfile has no `apps/*` / `packages/*` workspace entries.
2. `pnpm test:run` passes (release-config + app tests).
3. `pnpm run build:local` / `build:staging` produces artifacts in root `dist/`.
4. Repo-wide grep for `apps/app`, `--filter`, `@workspace/`, `pnpm-workspace`, `turbo`
   returns only historical `plans/`, `docs/specs/`, and graphify artifacts.
5. `pnpm lint` (app eslint) runs from root.
