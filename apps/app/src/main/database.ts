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
      FOREIGN KEY (session_id) REFERENCES sessions (id)
    );
  `)

  return db
}

// We export the promise so the main process can await it
export const dbPromise = initializeDatabase()
