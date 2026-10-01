# Knovy website

The Knovy marketing website lives in this directory. The Electron desktop app remains at the repository root and continues to store its data locally in SQLite.

## Development

Use Node.js 22 and npm inside `website/`:

```sh
npm ci
npm run dev
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

The website uses React, Vite, TypeScript, Tailwind CSS, and shadcn/ui. It requires no runtime environment variables or cloud credentials. Current public actions are macOS download, GitHub, video playback, navigation, theme switching, and contact links. There is no active waitlist signup form or website authentication.

## Vercel

Import `Intevia-AI/Knovy` into the intended Vercel account and set **Root Directory** to `website`. Use the Vite framework, `npm ci`, `npm run build`, and `dist` output. `vercel.json` includes the SPA fallback.

Preview and verify the website before pointing `knovy.app` and `www.knovy.app` at this Vercel project. Keep the old deployment available for rollback until the domains and routes have been verified. Vercel's Git integration should use `main` for production.

## Firebase

Project: `knovy-website` (`Knovy Website`). Cloud Firestore is the destination for the historical waitlist collection. The browser never connects to Firestore; management uses authorized project IAM access or the Firebase console.

The checked-in security rules deny every client read and write. Deploy them with:

```sh
firebase deploy --only firestore:rules,firestore:indexes --project knovy-website
```

Each document uses the original UUID as its document ID and contains the original `id`, `email`, and `created_at` values. All three are stored as strings, preserving the CSV timestamp's timezone and fractional precision exactly. Preserve the original email values, including capitalization or suspected typos.

Keep exports outside this repository. To import a private JSON array with these three fields, use an authorized Google application-default credential session, or inject a short-lived OAuth token through `GOOGLE_OAUTH_ACCESS_TOKEN` without recording it in files or logs:

```sh
GOOGLE_CLOUD_PROJECT=knovy-website node scripts/import-waitlist.mjs /absolute/private/path/waitlist.json
```

The importer validates duplicates, refuses conflicting existing documents, uses create-only atomic writes, and reads every document back to compare all original fields. A rerun with the same export verifies and skips existing documents. Its output contains only counts and status.

## Import provenance

Website source and assets were imported from `paulyao825/knovy-website-2.0`, commit `16caf9a3b3a976da18346e6f95bfa2c9a5e53516`, on 2026-10-01. This imports a source snapshot; the original repository retains its development history. Private `.env` configuration, user data, dependencies, and generated build files are excluded.

`archive/lovable/` preserves the original Supabase schema and integration source for reference. It is excluded from the running app and lint checks. The current website has no Lovable Cloud or Supabase dependency. Historical Bun lockfiles are retained for provenance; npm's `package-lock.json` is authoritative for this workflow.

The original Lovable project and database have not been removed. Do not remove them until the source, Firestore data, domains, and independent deployment have all been audited.
