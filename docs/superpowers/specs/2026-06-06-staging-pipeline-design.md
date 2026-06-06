# Staging build pipeline + release version guard — Design

**Date:** 2026-06-06
**Branch:** `chore/staging-pipeline`
**Status:** Approved (user delegated final choices; option 1 selected)

## Context

Branch model: `dev` → `stg` → `main`.

- `dev` — working/integration branch (no CI artifacts).
- `stg` — when something merges in, **build** a full-signed app to validate the real distributable.
- `main` — when staging looks good, merge and **publish** a live GitHub Release (existing
  tag-triggered workflow).

**Version base convention (post-release bump):** `package.json` on `dev`/`stg` holds the *next*
version (e.g. `0.3.9`), bumped once right after each release ("open the next version"). Staging
therefore builds `0.3.9-stg.<run>`, which sorts correctly: `0.3.8 < 0.3.9-stg.N < 0.3.9`. Using the
*current* production version as the base would be wrong — `0.3.8-stg.N` sorts *below* `0.3.8`. The
next-version number lives only on the integration branches, so feature worktrees never touch it and
never collide on it. After this pipeline lands on `main`, bump `dev`/`stg` to `0.3.9`.

Decision (industry-aligned, option 1): staging builds are distributed as **GitHub Actions
artifacts**, NOT GitHub Releases. This avoids auto-update feed collision (the app's
`electron-updater` reads `latest-mac.yml` from this repo's releases) and keeps the public
Releases page clean. Staging versions are cosmetic/traceability only — nothing auto-updates
from them.

## Feature 1 — Staging workflow (`.github/workflows/staging.yml`)

- **Trigger:** `on: push: branches: [stg]`.
- **Job** `staging-build` on `macos-latest`, `environment: Production` (for Apple signing secrets,
  since staging uses full signing).
- **Steps:**
  1. Checkout, setup Node 20, pnpm 10, pnpm cache (mirrors release.yml).
  2. `pnpm install --frozen-lockfile`.
  3. `pnpm test:run` — run the vitest config suite as a gate.
  4. **Apply staging version suffix** (in `apps/app`, uncommitted):
     `npm version "${BASE}-stg.${{ github.run_number }}" --no-git-tag-version --allow-same-version`
     → e.g. `0.3.8-stg.42`.
  5. **Build full-signed, no publish:** `pnpm --filter Knovy run build:staging`
     (= `electron-vite build && electron-builder --publish never`). Same Apple/CSC signing env as
     release.yml.
  6. **Upload artifacts:** `actions/upload-artifact@v4`, paths `apps/app/dist/*.{dmg,zip}`,
     `retention-days: 14`, `if-no-files-found: error` (fail loudly if the output path is wrong).
- **No release creation:** no `softprops/action-gh-release`, no electron-builder publish.

New script in `apps/app/package.json`:
`"build:staging": "electron-vite build && electron-builder --publish never"`.

## Feature 2 — Release version guard (`.github/workflows/release.yml`)

Add a step (after Node setup, before install) that fails the release if the pushed tag does not
match `apps/app/package.json` version — prevents the tag/version drift footgun where the published
update feed version disagrees with the release tag:

```yaml
- name: Verify tag matches app version
  run: |
    TAG="${GITHUB_REF_NAME#v}"
    PKG=$(node -p "require('./apps/app/package.json').version")
    test "$TAG" = "$PKG" || { echo "::error::Tag v$TAG != apps/app/package.json $PKG"; exit 1; }
```

## Testing (TDD)

Extend `test/release-config.test.ts` (root vitest). New structural assertions, each written
red-first:

- **Release guard:** release job has a step whose name mentions tag+version and whose `run`
  references `package.json`.
- **Staging trigger:** `staging.yml` `on.push.branches` includes `stg`.
- **Staging version suffix:** a step `run` contains `stg.` and `github.run_number`.
- **Staging no-publish:** a step `run` contains `--publish never`.
- **Staging artifacts:** a step `uses` contains `actions/upload-artifact`.
- **Staging is not a release:** file does not contain `softprops/action-gh-release`.

Note: js-yaml 4 (YAML 1.2 core schema) does NOT coerce the `on:` key to boolean `true`, so it
parses as the string key `on`. If a test surfaces otherwise, fall back to `wf['on'] ?? wf[true]`.

## TDD iterations (red → green → commit)

1. Release version guard (test → add step to release.yml).
2. Staging workflow scaffold + trigger (test → create staging.yml with `on: push: [stg]`).
3. Staging version suffix step (test → add npm version step).
4. Staging build:staging script + no-publish (test → add script + build step).
5. Staging artifact upload (test → add upload-artifact step).

## Risks / first-run verification

- electron-builder local output dir is assumed `apps/app/dist`. `if-no-files-found: error` makes a
  wrong path fail loudly on the first `stg` push rather than silently uploading nothing.
- Full signing on staging uses the `Production` environment secrets; the first run validates access.
- `--publish never` guarantees staging never touches the release feed even if a token is present.
