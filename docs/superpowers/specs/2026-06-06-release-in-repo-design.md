# Release within this repository — Design

**Date:** 2026-06-06
**Branch:** `chore/release-in-repo`
**Status:** Approved (design decisions confirmed via clarifying questions)

## Problem

CI currently builds and publishes the desktop app to a separate public repository,
`Intevia-AI/Knovy-Release`, using a personal access token (`RELEASE_PAT`). Now that this
repository is being open-sourced, releases should be created **within this repository**
instead of a separate one.

## Current state

- `.github/workflows/release.yml` — triggers on `v*.*.*` tags, runs `pnpm --filter Knovy run build:ci`,
  and exposes `GITHUB_TOKEN: ${{ secrets.RELEASE_PAT }}` to electron-builder. The job has **no**
  `permissions:` block.
- `apps/app/electron-builder.yml` — `publish:` block targets `provider: github`,
  `owner: Intevia-AI`, `repo: Knovy-Release`. This is what actually directs the GitHub release.

electron-builder reads the `GITHUB_TOKEN`/`GH_TOKEN` env var and publishes to the configured
`owner/repo` when run on CI against a tag.

## Desired state

1. `apps/app/electron-builder.yml` → `publish.repo: Knovy` (owner stays `Intevia-AI`), so releases
   land on this repository.
2. `.github/workflows/release.yml`:
   - Use the built-in `${{ secrets.GITHUB_TOKEN }}` instead of `secrets.RELEASE_PAT`. A personal
     token is no longer needed for cross-repo publishing.
   - Add `permissions: contents: write` to the `release` job. The built-in `GITHUB_TOKEN` cannot
     create releases without this grant.
   - Update the two comments that reference "Knovy-Release" / the release PAT.

## Decisions (confirmed)

- **Test mechanism:** vitest, added as a root dev dependency (approved). A root-level
  `test/release-config.test.ts` parses both YAML files with `js-yaml` (already in the dep tree)
  and asserts the publish target, token reference, and job permissions structurally.
- **Publish target:** hardcode `owner: Intevia-AI`, `repo: Knovy` (matches existing style).
- **Test location:** repo root, because the assertions span both the root `.github/` workflow and
  `apps/app/electron-builder.yml`.
- **Out of scope:** a separate "run tests in CI" PR workflow job. The vitest suite is a local/dev
  gate for this config change; a PR-CI job can be a follow-up.

## TDD iterations

Each iteration is a red → green → commit cycle (granular commits per project convention).

| # | Failing test asserts… | Fix |
|---|---|---|
| 1 | vitest runs; electron-builder `publish.repo === 'Knovy'` and `owner === 'Intevia-AI'` | add vitest config + dep; change `repo:` |
| 2 | `release.yml` build env's `GITHUB_TOKEN` resolves from `secrets.GITHUB_TOKEN`, **not** `RELEASE_PAT` | swap the secret reference |
| 3 | `release` job declares `permissions.contents === 'write'` | add `permissions:` block |
| 4 | No file under `.github/` nor `apps/app/electron-builder.yml` still contains `Knovy-Release` or `RELEASE_PAT` | clean up stale comments |

## Testing

- `pnpm test` / `pnpm test:run` at the repo root runs the vitest suite.
- The suite is self-contained: it reads the two config files from disk and asserts their parsed
  structure. No build, no network, no Electron required.

## Risks / notes

- The `GITHUB_TOKEN` permission grant is the one non-obvious requirement; without it the release
  step would fail at runtime even though the config looks correct. Iteration 3 encodes this.
- This change does not delete or archive the external `Knovy-Release` repo — that is a manual,
  out-of-band decision for the maintainer.
