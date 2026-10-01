import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

// Reuse a short-lived Google OAuth token; never store credentials with the export.
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const inputPath = process.argv[2];
if (!projectId || !inputPath) {
  throw new Error('Set GOOGLE_CLOUD_PROJECT and provide a private waitlist JSON file path.');
}
const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN || execFileSync(
  'gcloud', ['auth', 'application-default', 'print-access-token'], { encoding: 'utf8' }
).trim();
const source = JSON.parse(await readFile(inputPath, 'utf8'));
if (!Array.isArray(source) || !source.length || source.length > 500) {
  throw new Error('Expected 1 to 500 source records.');
}
const keys = ['id', 'email', 'created_at'];
for (const row of source) {
  if (Object.keys(row).sort().join(',') !== [...keys].sort().join(',') ||
      keys.some(key => typeof row[key] !== 'string' || !row[key]) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id) ||
      Number.isNaN(Date.parse(row.created_at))) {
    throw new Error('Invalid source record; refusing to import.');
  }
}
if (new Set(source.map(row => row.id)).size !== source.length ||
    new Set(source.map(row => row.email.toLowerCase())).size !== source.length) {
  throw new Error('Duplicate source IDs or emails; refusing to import.');
}
const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
async function request(url, method = 'GET', body) {
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!response.ok) throw new Error(`Firestore ${method} failed with HTTP ${response.status}.`);
  return response.json();
}
async function readCollection() {
  const documents = [];
  let pageToken;
  do {
    const query = new URLSearchParams({ pageSize: '1000', ...(pageToken ? { pageToken } : {}) });
    const page = await request(`${base}/waitlist?${query}`);
    documents.push(...(page.documents || []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return documents;
}
function matches(document, row) {
  return document.name.endsWith(`/waitlist/${row.id}`) &&
    keys.every(key => document.fields?.[key]?.stringValue === row[key]) &&
    Object.keys(document.fields || {}).sort().join(',') === [...keys].sort().join(',');
}
const existing = await readCollection();
const byId = new Map(existing.map(document => [document.name.split('/').at(-1), document]));
const sourceById = new Map(source.map(row => [row.id, row]));
for (const document of existing) {
  const row = sourceById.get(document.name.split('/').at(-1));
  if (!row || !matches(document, row)) throw new Error('Destination differs from export; refusing to overwrite.');
}
const missing = source.filter(row => !byId.has(row.id));
if (missing.length) {
  await request(`${base}:commit`, 'POST', { writes: missing.map(row => ({
    update: {
      name: `projects/${projectId}/databases/(default)/documents/waitlist/${row.id}`,
      fields: Object.fromEntries(keys.map(key => [key, { stringValue: row[key] }]))
    },
    currentDocument: { exists: false }
  })) });
}
const verified = await readCollection();
if (verified.length !== source.length || verified.some(document => {
  const row = sourceById.get(document.name.split('/').at(-1));
  return !row || !matches(document, row);
})) throw new Error('Post-import verification failed.');
console.log(JSON.stringify({ projectId, collection: 'waitlist', sourceCount: source.length,
  importedCount: missing.length, verifiedCount: verified.length, allFieldsMatch: true }));
