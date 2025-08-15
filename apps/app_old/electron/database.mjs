
import path from 'path';
import { app } from 'electron';
import Database from 'better-sqlite3';

const dbPath = path.join(app.getPath('userData'), 'intevia_sessions.db');
const db = new Database(dbPath);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    started_at INTEGER,
    ended_at INTEGER,
    status TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS transcripts (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    timestamp INTEGER,
    content TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions (id)
  );
`);

export default db;
