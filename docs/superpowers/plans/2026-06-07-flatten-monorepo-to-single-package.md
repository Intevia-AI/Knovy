# Flatten Monorepo → Single-Package Repo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dissolve the now-single-app monorepo so the repo root *is* the Knovy Electron app, removing the `apps/`/`packages/` workspace scaffold and Turborepo, and bring docs in line.

**Architecture:** Move `apps/app/*` to the repo root, resolving 5 file collisions; delete the orphaned `packages/ui` and the root-only `packages/eslint-config` + `packages/typescript-config`; merge the two `package.json` files into one; remove `pnpm-workspace.yaml`/`turbo.json`; regenerate the lockfile; rewrite CI pipeline paths; update docs. Each group is its own commit.

**Tech Stack:** pnpm 10, electron-vite, electron-builder, vitest, GitHub Actions.

**Branch:** `chore/flatten-monorepo` (already created off `dev`; spec committed as `c92fc5b`).

**Reference spec:** `docs/superpowers/specs/2026-06-07-flatten-monorepo-to-single-package-design.md`

---

## File Structure (end state)

```
/
├── src/  resources/  code-signing/  tests/        (moved from apps/app/)
├── electron.vite.config.ts  electron-builder.yml  entitlements.mac.plist
├── tailwind.config.ts  postcss.config.mjs  components.json  eslint.config.mjs
├── tsconfig.json  tsconfig.node.json  tsconfig.web.json   (app's, references-based)
├── package.json                                   (merged)
├── .gitignore  .prettierrc.yaml  .editorconfig  .npmrc  .prettierignore
├── .env.example  dev-app-update.yml
├── docs/  plans/  scripts/  types/  .github/       (root, unchanged except CI + docs)
└── README.md  CONTRIBUTING.md  CLAUDE.md
```

Deleted: `apps/`, `packages/`, `pnpm-workspace.yaml`, `turbo.json`, root `.eslintrc.js`, root `test/` (→ `tests/`).

**Collision resolution (root ← apps/app):**

| File | Resolution |
|------|-----------|
| `package.json` | merge (Task 3) |
| `tsconfig.json` | app's wins; root's deleted |
| `.gitignore` | merged union, root-relative (Task 4) |
| `.prettierrc.yaml` | app's wins (root's deleted) |
| `README.md` | root's kept; app's deleted (app's is stale: references Gemini/Supabase) |

---

## Task 1: Remove orphaned `packages/ui`

**Files:**
- Delete: `packages/ui/` (entire directory)

Rationale: `@workspace/ui` appears in zero `dependencies` repo-wide (verified) — only its own
`name`, self-imports, one historical plan doc.

- [ ] **Step 1: Confirm no consumer exists**

Run:
```bash
grep -rn '"@workspace/ui"' --include=package.json . | grep -v node_modules | grep -v 'packages/ui/package.json'
```
Expected: no output (empty).

- [ ] **Step 2: Delete the package**

Run:
```bash
git rm -r packages/ui
```
Expected: lists the removed files, no errors.

- [ ] **Step 3: Commit**

```bash
git commit -m "Chore: Remove orphaned packages/ui (dead after web/admin removal)"
```

---

## Task 2: Move `apps/app/*` to repo root (non-colliding entries)

**Files:**
- Move (git mv, history-preserving) each non-colliding tracked entry from `apps/app/` to root.

The 18 non-colliding tracked entries are: `.editorconfig`, `.env.example`, `.npmrc`,
`.prettierignore`, `code-signing`, `components.json`, `dev-app-update.yml`,
`electron-builder.yml`, `electron.vite.config.ts`, `entitlements.mac.plist`,
`eslint.config.mjs`, `postcss.config.mjs`, `resources`, `src`, `tailwind.config.ts`,
`tests`, `tsconfig.node.json`, `tsconfig.web.json`.

- [ ] **Step 1: Move non-colliding entries**

Run:
```bash
cd /Users/tweizh/DEV/Intevia/Knovy
for x in .editorconfig .env.example .npmrc .prettierignore code-signing components.json \
  dev-app-update.yml electron-builder.yml electron.vite.config.ts entitlements.mac.plist \
  eslint.config.mjs postcss.config.mjs resources src tailwind.config.ts tests \
  tsconfig.node.json tsconfig.web.json; do
  git mv "apps/app/$x" "$x"
done
```
Expected: no errors. (If `tests/` collides with root `test/` — it will not; names differ.)

- [ ] **Step 2: Resolve the `tsconfig.json` collision (app's wins)**

Run:
```bash
git rm tsconfig.json
git mv apps/app/tsconfig.json tsconfig.json
```
Expected: root tsconfig (extended deleted `@workspace/typescript-config`) removed; app's
references-based tsconfig now at root.

- [ ] **Step 3: Resolve the `.prettierrc.yaml` collision (app's wins)**

Run:
```bash
git rm .prettierrc.yaml
git mv apps/app/.prettierrc.yaml .prettierrc.yaml
```

- [ ] **Step 4: Delete the stale app README (root README kept)**

Run:
```bash
git rm apps/app/README.md
```

- [ ] **Step 5: Verify nothing tracked remains under apps/ except the two collision files handled in later tasks**

Run:
```bash
git ls-files apps/
```
Expected: only `apps/app/.gitignore` and `apps/app/package.json` remain (handled in Tasks 3–4).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Chore: Move apps/app contents to repo root"
```

---

## Task 3: Merge `package.json`

**Files:**
- Modify: root `package.json` (replace with merged content)
- Delete: `apps/app/package.json`

Merge rule: **base = `apps/app/package.json`** (the Knovy app), then apply the additions and
removals below. Preserve the app's existing `version` value as-is.

- [ ] **Step 1: Author the merged root `package.json`**

Start from the current `apps/app/package.json` and apply exactly these changes:

**Add these scripts** (alongside the existing `dev`/`build`/`build:ci`/`build:staging`/`build:local`/`postinstall`):
```json
"test": "vitest",
"test:run": "vitest run",
"format": "prettier --write \"**/*.{ts,tsx,md}\""
```

**Remove from `devDependencies`:**
```
"@workspace/eslint-config"
"@workspace/typescript-config"
```

**Add to `devDependencies`** (versions copied verbatim from the current root `package.json`):
```json
"@types/js-yaml": "^4.0.9",
"js-yaml": "^4.1.0",
"prettier": "^3.5.1",
"vitest": "^3.0.0"
```
(Note: `turbo` and `concurrently` from root are intentionally NOT carried over — turbo is
gone, concurrently ran the removed history-viewer.)

**Add these top-level fields** (copied verbatim from the current root `package.json`):
```json
"packageManager": "pnpm@10.4.1",
"engines": { "node": ">=20" },
"pnpm": {
  "onlyBuiltDependencies": [
    "@tailwindcss/oxide",
    "@vercel/speed-insights",
    "core-js-pure",
    "electron",
    "electron-winstaller",
    "esbuild",
    "sharp",
    "sqlite3"
  ]
}
```

Do NOT carry over the root `dependencies` block (`@eslint/js`, `typescript-eslint`) — those
backed the deleted root `.eslintrc.js`; the app's `eslint.config.mjs` uses `@electron-toolkit/*`.

Write the result to the root `package.json` (overwrite).

- [ ] **Step 2: Verify no `@workspace/` references remain in the merged file**

Run:
```bash
grep -n "@workspace/\|turbo\|concurrently" package.json
```
Expected: no output.

- [ ] **Step 3: Remove the app's now-redundant package.json**

Run:
```bash
git rm apps/app/package.json
```
Expected: `apps/app/` is now empty of tracked files.

- [ ] **Step 4: Verify `apps/` is fully untracked-empty and remove the empty dir**

Run:
```bash
git ls-files apps/
rmdir apps/app apps 2>/dev/null; true
```
Expected: first command prints nothing.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "Chore: Merge app and root package.json into single root manifest"
```

---

## Task 4: Remove workspace scaffold and merge `.gitignore`

**Files:**
- Delete: `packages/eslint-config/`, `packages/typescript-config/`, `pnpm-workspace.yaml`, `turbo.json`, root `.eslintrc.js`
- Modify: root `.gitignore` (merge in app entries, strip dead paths), delete `apps/app/.gitignore`

- [ ] **Step 1: Delete the remaining workspace config packages and root configs**

Run:
```bash
git rm -r packages/eslint-config packages/typescript-config
git rm pnpm-workspace.yaml turbo.json .eslintrc.js
rmdir packages 2>/dev/null; true
```
Expected: files removed, no errors.

- [ ] **Step 2: Merge `.gitignore`**

Replace the root `.gitignore` with the union below — root entries with `apps/app/` prefixes
rewritten to root-relative, dead paths (`apps/app_old/...`, `supabase/...`) dropped, and the
app's unique entries folded in:

```gitignore
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# Dependencies
node_modules
.pnp
.pnp.js

# Local env files
.env
.env.local
.env.development
.env.development.local
.env.test.local
.env.production
.env.production.local

# Testing
coverage

# Build Outputs
out/
build
dist
.eslintcache

# Debug
*.log*
npm-debug.log*

# Misc
.DS_Store
*.pem
.debug
.prompts.md
.prompts_app.md
.prompts_web.md
.prompts_admin.md
**/private_keys/
.vscode/
.claude/

# Code signing
certificate.p12
build-mac-signed.sh

# Built history viewer copied into the app public folder (not committed)
src/renderer/public/history

# Local transcription models (downloaded at runtime)
resources/whisper.cpp/models/
```

Then remove the app's `.gitignore`:
```bash
git rm apps/app/.gitignore
```

- [ ] **Step 3: Verify no workspace/turbo residue in tracked config**

Run:
```bash
grep -rn "pnpm-workspace\|turbo\|@workspace/" --include=*.json --include=*.js --include=*.mjs --include=*.yaml --include=*.yml . | grep -v node_modules | grep -v graphify-out | grep -v docs/superpowers
```
Expected: no output (matches only in plans/specs are excluded by the filter above; if any
appear, they are historical plan docs — confirm and ignore).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Chore: Remove pnpm workspace + turbo scaffold and merge .gitignore"
```

---

## Task 5: Consolidate tests and rewrite CI pipeline paths

**Files:**
- Move: `test/release-config.test.ts` → `tests/release-config.test.ts`; delete root `test/`
- Modify: `tests/release-config.test.ts` (fix `apps/app/electron-builder.yml` path)
- Modify: `.github/workflows/release.yml`, `.github/workflows/staging.yml`

- [ ] **Step 1: Move the release-config test into the app's tests dir**

Run:
```bash
git mv test/release-config.test.ts tests/release-config.test.ts
rmdir test 2>/dev/null; true
```

- [ ] **Step 2: Fix the electron-builder path in the test**

In `tests/release-config.test.ts`, change:
```ts
const config = readYaml('apps/app/electron-builder.yml')
```
to:
```ts
const config = readYaml('electron-builder.yml')
```
(Leave the `.github/workflows/release.yml` read unchanged — workflows stay at root. Note the
test computes `repoRoot` as one level up from its own dir; since the test now sits in
`tests/`, `resolve(dirname, '..')` still resolves to the repo root. Verify in Step 6.)

- [ ] **Step 3: Rewrite `release.yml`**

In `.github/workflows/release.yml`:
- Change the "Verify tag matches app version" step body from
  `PKG=$(node -p "require('./apps/app/package.json').version")`
  to `PKG=$(node -p "require('./package.json').version")`
  and the error string `apps/app/package.json version` → `package.json version`.
- Change the final step `run: pnpm --filter Knovy run build:ci` → `run: pnpm run build:ci`.

- [ ] **Step 4: Rewrite `staging.yml`**

In `.github/workflows/staging.yml`:
- In the "Apply staging version suffix" step, remove the line `working-directory: apps/app`
  (the `package.json` is now at root, which is the default working directory).
- Change `run: pnpm --filter Knovy run build:staging` → `run: pnpm run build:staging`.
- In the "Upload staging build artifacts" step, change the `path:` entries
  `apps/app/dist/*.dmg` → `dist/*.dmg` and `apps/app/dist/*.zip` → `dist/*.zip`.

- [ ] **Step 5: Grep sweep for residual paths**

Run:
```bash
grep -rn "apps/app\|--filter Knovy\|--filter app" .github/ tests/ package.json
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Chore: Consolidate tests and update CI paths for flat layout"
```

---

## Task 6: Regenerate lockfile and verify the build wiring

**Files:**
- Modify: `pnpm-lock.yaml` (regenerated)

- [ ] **Step 1: Regenerate the lockfile**

Run:
```bash
SKIP_ELECTRON_POSTINSTALL=true pnpm install
```
Expected: install completes; `pnpm-lock.yaml` updated. (`SKIP_ELECTRON_POSTINSTALL` avoids the
electron-builder app-deps rebuild during planning; the real CI runs it.) If the flag causes
issues, run plain `pnpm install`.

- [ ] **Step 2: Verify the lockfile has no workspace package entries**

Run:
```bash
grep -n "packages/ui\|packages/eslint-config\|packages/typescript-config\|apps/app" pnpm-lock.yaml
```
Expected: no output.

- [ ] **Step 3: Run the config tests**

Run:
```bash
timeout 30 pnpm test:run
```
Expected: PASS — including `tests/release-config.test.ts` (it reads `electron-builder.yml` and
`.github/workflows/release.yml` from repo root).

- [ ] **Step 4: Full residual grep sweep across the repo**

Run:
```bash
grep -rn "apps/app\|--filter Knovy\|@workspace/\|pnpm-workspace\|turbo" \
  --include=*.json --include=*.yaml --include=*.yml --include=*.js --include=*.mjs --include=*.ts \
  . | grep -v node_modules | grep -v graphify-out | grep -v "docs/superpowers" | grep -v "plans/"
```
Expected: no output (any hits in `plans/` or `docs/superpowers/` are historical and excluded).

- [ ] **Step 5: Commit**

```bash
git add pnpm-lock.yaml
git commit -m "Chore: Regenerate lockfile for single-package layout"
```

---

## Task 7: Update documentation

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`

- [ ] **Step 1: Update `CLAUDE.md`**

In `/Users/tweizh/DEV/Intevia/Knovy/CLAUDE.md`:
- **Development Commands → Monorepo Management:** rename to single-app; remove Turbo references.
  Replace `pnpm dev`/`pnpm build`/`pnpm lint` turbo descriptions with the direct app scripts
  (`pnpm dev` = `electron-vite dev`, `pnpm build:local`, `pnpm lint`, `pnpm test:run`).
- **Application-Specific Commands:** delete the `History Viewer (apps/history-viewer)` subsection
  and the `pnpm --filter app dev` / `pnpm --filter history-viewer ...` lines; replace with
  root-level `pnpm dev` / `pnpm build:local`.
- **Architecture Overview → Project Structure:** replace the `apps/` + `packages/` tree with the
  flat root layout (src/, resources/, code-signing/, tests/, docs/, etc.).
- Remove the "History Viewer" technology-stack bullet and the "History Viewer: Embedded Next.js"
  Important-Notes bullet, and the "Shared Packages" / "Local Development runs history-viewer"
  bullets.
- Update all `apps/app/src/...` path references — they remain valid since the file moved with its
  `src/` tree, so paths change from `apps/app/src/main/index.ts` → `src/main/index.ts`. Update the
  Key Files / Electron Architecture / Database paths accordingly.

- [ ] **Step 2: Update `README.md`**

In `/Users/tweizh/DEV/Intevia/Knovy/README.md`, update any project-structure diagram, setup
steps, and command examples that reference `apps/app`, `apps/history-viewer`, `packages/*`,
`pnpm --filter`, or Turborepo to the single-package root layout and direct `pnpm` scripts.

- [ ] **Step 3: Update `CONTRIBUTING.md`**

In `/Users/tweizh/DEV/Intevia/Knovy/CONTRIBUTING.md`, update any structure references,
`pnpm --filter` commands, or `apps/`/`packages/` mentions to the flat layout.

- [ ] **Step 4: Grep sweep docs for stale structure references**

Run:
```bash
grep -rn "apps/app\|apps/history-viewer\|--filter\|packages/ui\|Turborepo\|pnpm-workspace" \
  CLAUDE.md README.md CONTRIBUTING.md
```
Expected: no output (or only intentional historical mentions you've confirmed).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md CONTRIBUTING.md
git commit -m "Docs: Update structure and commands for single-package layout"
```

---

## Final verification (after all tasks)

- [ ] `git ls-files apps/ packages/` → empty.
- [ ] `pnpm install` clean; `pnpm-lock.yaml` has no `apps/`/`packages/` entries.
- [ ] `timeout 30 pnpm test:run` → PASS.
- [ ] `pnpm lint` runs from root (app eslint).
- [ ] Optional (only if asked): `pnpm run build:local` produces artifacts in root `dist/`.
- [ ] Repo-wide grep for `apps/app` / `--filter` / `@workspace/` returns only historical
      `plans/` and `docs/superpowers/` matches.

## Notes / risks (from spec)

- **Release pipeline is the blast radius** — Task 5 + the grep sweeps are the guard; the
  `release-config.test.ts` runs in `staging.yml` on push to `stg`.
- **electron-builder relative paths** (`./code-signing/*`, icons, entitlements) stay valid —
  those files moved to root with the config.
- **Prettier config switched** to the app's (no-semi/single-quote) for the whole repo; root
  tooling files (`scripts/`, `types/`) may now report as unformatted. Acceptable; run
  `pnpm format` once if desired (not required).
