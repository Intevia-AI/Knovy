import path from 'path'
import { app } from 'electron'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'

const dbPath = path.join(app.getPath('userData'), 'intevia_sessions.db')

// This function will open the database and create tables if they don't exist
async function initializeDatabase() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  })

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
      started_at TEXT,
      ended_at TEXT,
      status TEXT
    );
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      timestamp TEXT,
      content TEXT,
      source_type TEXT DEFAULT 'system',
      FOREIGN KEY (session_id) REFERENCES sessions (id)
    );
  `)

  // Add source_type column to existing transcripts table if it doesn't exist
  try {
    await db.exec(`
      ALTER TABLE transcripts ADD COLUMN source_type TEXT DEFAULT 'system';
    `)
  } catch (error) {
    // Column already exists, ignore error
    console.log('[DB] source_type column already exists or another error occurred')
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      content TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
    );
  `)

  return db
}

// We export the promise so the main process can await it
export const dbPromise = initializeDatabase()
